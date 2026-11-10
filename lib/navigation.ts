export function isNavigationActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/tarjetas/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
