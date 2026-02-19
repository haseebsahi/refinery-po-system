
-- Drop the overly permissive ALL policies on writable tables
DROP POLICY IF EXISTS "POs are publicly accessible" ON public.purchase_orders;
DROP POLICY IF EXISTS "Line items are publicly accessible" ON public.po_line_items;
DROP POLICY IF EXISTS "Status history is publicly accessible" ON public.po_status_history;

-- purchase_orders: public read, no direct client writes (edge functions use service role)
CREATE POLICY "POs are publicly readable"
ON public.purchase_orders FOR SELECT
USING (true);

-- po_line_items: public read, no direct client writes
CREATE POLICY "Line items are publicly readable"
ON public.po_line_items FOR SELECT
USING (true);

-- po_status_history: public read, no direct client writes
CREATE POLICY "Status history is publicly readable"
ON public.po_status_history FOR SELECT
USING (true);
