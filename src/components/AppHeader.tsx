import { Link, useLocation } from "react-router-dom";
import { ShoppingCart, ClipboardList, Search, Package } from "lucide-react";
import { usePOContext } from "@/context/PODraftContext";
import { Badge } from "@/components/ui/badge";

export default function AppHeader() {
  const location = useLocation();
  const { draft } = usePOContext();
  const itemCount = draft.lineItems.reduce((s, li) => s + li.quantity, 0);

  const links = [
    { to: "/", label: "Catalog", icon: Search },
    { to: "/draft", label: "Draft PO", icon: ShoppingCart },
    { to: "/orders", label: "Orders", icon: ClipboardList },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-primary text-primary-foreground">
      <div className="container flex h-14 items-center gap-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Package className="h-5 w-5 text-accent" />
          <span className="hidden sm:inline">Refinery PO System</span>
        </Link>
        <nav className="flex items-center gap-1 ml-auto">
          {links.map((l) => {
            const active = location.pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-primary-foreground"
                    : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
                {l.to === "/draft" && itemCount > 0 && (
                  <Badge className="ml-1 h-5 min-w-[20px] bg-accent text-accent-foreground text-xs px-1.5">
                    {itemCount}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
