export function isNavigationActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/tarjetas/") || pathname.startsWith("/meses/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
