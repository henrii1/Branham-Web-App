import Image from "next/image";
import Link from "next/link";
import logo from "../../../logo.png";

interface BrandLogoProps {
  href?: string;
  showName?: boolean;
  size?: number;
  priority?: boolean;
  className?: string;
  nameClassName?: string;
}

export function BrandLogo({
  href = "/chat",
  showName = true,
  size = 36,
  priority = false,
  className = "",
  nameClassName = "",
}: BrandLogoProps) {
  const content = (
    <>
      <Image
        src={logo}
        alt="BranhamSermons.ai logo"
        width={size}
        height={size}
        priority={priority}
        className="rounded-lg object-cover"
      />
      {showName && (
        <span
          className={`font-display text-base leading-[1.05] font-semibold text-foreground ${nameClassName}`.trim()}
        >
          {/* Wraps as "Branham / Sermons.ai" when a narrow header needs it. */}
          Branham<wbr />Sermons.ai
        </span>
      )}
    </>
  );

  // No prefetch: the logo sits on every chat/FAQ screen, and prefetching its
  // (dynamic) target re-renders a whole page on the server for each visit.
  return (
    <Link
      prefetch={false}
      href={href}
      className={`inline-flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-90 ${className}`.trim()}
      aria-label="BranhamSermons.ai home"
    >
      {content}
    </Link>
  );
}
