
-- Enable trigram extension FIRST
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Catalog items table
CREATE TABLE public.catalog_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  supplier TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_usd NUMERIC(12,2) NOT NULL CHECK (price_usd >= 0),
  lead_time_days INTEGER NOT NULL CHECK (lead_time_days >= 0),
  in_stock BOOLEAN NOT NULL DEFAULT false,
  specs JSONB DEFAULT '{}',
  compatible_with TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_category ON public.catalog_items (category);
CREATE INDEX idx_catalog_supplier ON public.catalog_items (supplier);
CREATE INDEX idx_catalog_price ON public.catalog_items (price_usd);
CREATE INDEX idx_catalog_lead_time ON public.catalog_items (lead_time_days);
CREATE INDEX idx_catalog_in_stock ON public.catalog_items (in_stock);
CREATE INDEX idx_catalog_name_trgm ON public.catalog_items USING gin (name gin_trgm_ops);

-- Full-text search
ALTER TABLE public.catalog_items ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name,'') || ' ' || coalesce(id,'') || ' ' || coalesce(supplier,'') || ' ' || coalesce(manufacturer,'') || ' ' || coalesce(model,''))
  ) STORED;
CREATE INDEX idx_catalog_fts ON public.catalog_items USING gin (search_vector);

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalog items are publicly readable"
  ON public.catalog_items FOR SELECT USING (true);

-- PO status enum
CREATE TYPE public.po_status AS ENUM ('Draft', 'Submitted', 'Approved', 'Rejected', 'Fulfilled');

-- Purchase orders
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE DEFAULT '',
  supplier TEXT NOT NULL,
  requestor TEXT NOT NULL,
  cost_center TEXT NOT NULL DEFAULT '',
  needed_by_date DATE,
  payment_terms TEXT NOT NULL DEFAULT 'Net 30',
  current_status public.po_status NOT NULL DEFAULT 'Draft',
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  idempotency_key UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_po_status ON public.purchase_orders (current_status);
CREATE INDEX idx_po_supplier ON public.purchase_orders (supplier);
CREATE INDEX idx_po_created ON public.purchase_orders (created_at DESC);

-- PO line items
CREATE TABLE public.po_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  catalog_item_id TEXT NOT NULL REFERENCES public.catalog_items(id),
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(po_id, catalog_item_id)
);

CREATE INDEX idx_line_items_po ON public.po_line_items (po_id);

-- Status audit trail
CREATE TABLE public.po_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  status public.po_status NOT NULL,
  note TEXT DEFAULT '',
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_po ON public.po_status_history (po_id, transitioned_at);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_catalog_updated_at BEFORE UPDATE ON public.catalog_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Single-supplier enforcement
CREATE OR REPLACE FUNCTION public.enforce_single_supplier()
RETURNS TRIGGER AS $$
DECLARE po_supplier TEXT; item_supplier TEXT;
BEGIN
  SELECT supplier INTO po_supplier FROM public.purchase_orders WHERE id = NEW.po_id;
  SELECT supplier INTO item_supplier FROM public.catalog_items WHERE id = NEW.catalog_item_id;
  IF po_supplier IS DISTINCT FROM item_supplier THEN
    RAISE EXCEPTION 'Supplier mismatch: PO locked to "%" but item belongs to "%"', po_supplier, item_supplier USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_enforce_single_supplier BEFORE INSERT OR UPDATE ON public.po_line_items FOR EACH ROW EXECUTE FUNCTION public.enforce_single_supplier();

-- Recalculate PO total
CREATE OR REPLACE FUNCTION public.recalculate_po_total()
RETURNS TRIGGER AS $$
DECLARE target_po_id UUID;
BEGIN
  target_po_id := COALESCE(NEW.po_id, OLD.po_id);
  UPDATE public.purchase_orders SET total_amount = COALESCE((SELECT SUM(quantity * unit_price) FROM public.po_line_items WHERE po_id = target_po_id), 0) WHERE id = target_po_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_recalculate_total AFTER INSERT OR UPDATE OR DELETE ON public.po_line_items FOR EACH ROW EXECUTE FUNCTION public.recalculate_po_total();

-- PO number generation
CREATE SEQUENCE public.po_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := 'PO-' || LPAD(nextval('public.po_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_generate_po_number BEFORE INSERT ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.generate_po_number();

-- Status transition validation
CREATE OR REPLACE FUNCTION public.validate_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_status = NEW.current_status THEN RETURN NEW; END IF;
  IF (OLD.current_status = 'Draft' AND NEW.current_status IN ('Submitted')) OR
     (OLD.current_status = 'Submitted' AND NEW.current_status IN ('Approved', 'Rejected')) OR
     (OLD.current_status = 'Approved' AND NEW.current_status IN ('Fulfilled')) OR
     (OLD.current_status = 'Rejected' AND NEW.current_status IN ('Draft')) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Invalid status transition from "%" to "%"', OLD.current_status, NEW.current_status USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_status_transition BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.validate_status_transition();

-- Auto-record status history
CREATE OR REPLACE FUNCTION public.record_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.po_status_history (po_id, status, note) VALUES (NEW.id, NEW.current_status, 'PO created');
  ELSIF OLD.current_status IS DISTINCT FROM NEW.current_status THEN
    INSERT INTO public.po_status_history (po_id, status, note) VALUES (NEW.id, NEW.current_status, '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_record_status_change AFTER INSERT OR UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.record_status_change();

-- RLS (public access - no auth required for this app)
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "POs are publicly accessible" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Line items are publicly accessible" ON public.po_line_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.po_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Status history is publicly accessible" ON public.po_status_history FOR ALL USING (true) WITH CHECK (true);
