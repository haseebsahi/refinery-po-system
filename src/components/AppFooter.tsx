import { Heart } from "lucide-react";

export default function AppFooter() {
  return (
    <footer className="border-t bg-background text-muted-foreground mt-auto">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-2 py-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span>Made with</span>
          <Heart className="h-4 w-4 text-accent fill-accent" />
          <span>by</span>
          <a
            href="https://github.com/haseebsahi"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2 hover:text-primary transition-colors text-foreground"
          >
            Haseeb S.
          </a>
        </div>
        <p className="opacity-70">© {new Date().getFullYear()} All rights reserved.</p>
      </div>
    </footer>
  );
}
