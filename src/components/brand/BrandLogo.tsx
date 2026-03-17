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
        alt="Branham Sermons AI logo"
        width={size}
        height={size}
        priority={priority}
        className="rounded-lg object-cover"
      />
      {showName && (
        <span
          className={`font-display text-base leading-none font-semibold text-foreground ${nameClassName}`.trim()}
        >
          Branham Sermons Study Assistant
        </span>
      )}
    </>
  );

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-90 ${className}`.trim()}
      aria-label="Branham Sermons Study Assistant home"
    >
      {content}
    </Link>
  );
}
