import Link from "next/link";
import type { ReactNode } from "react";
import type { CardColor } from "@/lib/card-colors";
import { formatMoney } from "@/lib/format";
import { v2Routes } from "@/lib/routes";
import { Alert } from "./alert";
import { Amount } from "./amount";
import { Button, ButtonLink } from "./button";
import { CardDot } from "./card-dot";
import { Checkbox } from "./checkbox";
import { Chip } from "./chip";
import { DataTable } from "./data-table";
import { Dialog, DialogClose } from "./dialog";
import { EmptyState } from "./empty-state";
import { describedBy, Field, FieldGroup } from "./field";
import { InfoTip } from "./info-tip";
import { AmountInput, Input } from "./input";
import { InstallmentProgress } from "./installment-progress";
import { Menu, MenuItem } from "./menu";
import { MonthColumns, type MonthColumn } from "./month-columns";
import { HeroPanel, Panel } from "./panel";
import { PageHeader } from "./page-header";
import { Row, RowList } from "./row";
import { Segmented } from "./segmented";
import { Select } from "./select";
import { Skeleton } from "./skeleton";
import { StackedBar } from "./stacked-bar";
import { StatBlock } from "./stat-block";
import { Stepper } from "./stepper";
import { Switch } from "./switch";
import { Toast } from "./toast";
import { UtilizationBar } from "./utilization-bar";

/** Fictitious example data: never real amounts or cards. */
const cards: Array<{ key: string; name: string; last4: string; color: CardColor }> = [
  { key: "visa", name: "Visa Banco Andino", last4: "4521", color: "card-1" },
  { key: "master", name: "Mastercard Banco Andino", last4: "7788", color: "card-2" },
];
const months: MonthColumn[] = [
  { key: "oct", label: "Oct", caption: "Pagado", captionTone: "paid", settled: true, total: "$2.640.000", segments: [{ key: "v", color: "card-1", value: "1200000" }, { key: "m", color: "card-2", value: "1440000" }] },
  { key: "nov", label: "Nov", caption: "Pagado", captionTone: "paid", settled: true, total: "$2.734.500", segments: [{ key: "v", color: "card-1", value: "1245200" }, { key: "m", color: "card-2", value: "1489300" }] },
  { key: "dic", label: "Dic", caption: "Pagas el 2", current: true, total: "$2.819.300", segments: [{ key: "v", color: "card-1", value: "1178800" }, { key: "m", color: "card-2", value: "1640500" }] },
  { key: "ene", label: "Ene", caption: "Abierto", total: "$1.716.900", segments: [{ key: "v", color: "card-1", value: "734500", estimated: true }, { key: "m", color: "card-2", value: "982400", estimated: true }] },
  { key: "feb", label: "Feb", caption: "Estimado", total: "$1.213.400", segments: [{ key: "v", color: "card-1", value: "601400", estimated: true }, { key: "m", color: "card-2", value: "612000", estimated: true }] },
];
const monthRows = [
  { key: "dic", month: "Diciembre 2026", state: <Chip variant="due">Por pagar</Chip>, visa: "1178800", master: "1640500", usd: "9" },
  { key: "ene", month: "Enero 2027", state: <Chip variant="estimated">Abierto</Chip>, visa: "734500", master: "982400", usd: "7.6" },
  { key: "nov", month: "Noviembre 2026", state: <Chip variant="paid">Pagado</Chip>, visa: "1245200", master: "1489300", usd: "6" },
];

function Example({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return <div className={wide ? "ui:col-span-full ui:flex ui:min-w-0 ui:flex-col ui:gap-2.5" : "ui:flex ui:min-w-0 ui:flex-col ui:gap-2.5"}>
    <span className="ui:text-label ui:uppercase ui:text-text-3">{title}</span>
    {children}
  </div>;
}

function Box({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return <div className={centered ? "ui:flex ui:min-h-37.5 ui:flex-col ui:items-center ui:justify-center ui:gap-3 ui:rounded-panel ui:bg-surface ui:p-6 ui:text-center" : "ui:flex ui:min-h-37.5 ui:flex-col ui:justify-center ui:gap-3 ui:rounded-panel ui:bg-surface ui:p-6"}>{children}</div>;
}

/** Every v2 component and state with example data (docs/mockups/v2/estados.html), for the gallery in each theme. */
export function DesignCatalog({ idPrefix }: { idPrefix: string }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return <div className="ui:grid ui:grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] ui:gap-7">
    <Example title="Encabezado" wide>
      <PageHeader eyebrow="Domingo 22 de noviembre" trail={[{ href: v2Routes.cards, label: "Tarjetas" }]} back={{ href: v2Routes.cards, label: "Tarjetas" }} title="Mastercard" actions={<ButtonLink href={v2Routes.settings} variant="secondary">Editar tarjeta</ButtonLink>} />
    </Example>

    <Example title="Bloque principal" wide>
      <HeroPanel label="Próximo pago">
        <div className="ui:grid ui:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] ui:items-center ui:gap-8">
          <div className="ui:flex ui:flex-col ui:gap-3">
            <span className="ui:text-label ui:uppercase ui:text-text-2">Próximo pago · Mié 2 dic · en 10 días</span>
            <Amount size="hero" value="2819300" currency="COP" second={{ value: "9", currency: "USD" }} />
            <Link href={v2Routes.month("2026-12")} className="ui:text-support">Ver diciembre</Link>
          </div>
          <div className="ui:flex ui:flex-col ui:gap-3.5">
            <StackedBar items={[{ key: "visa", label: "Visa", color: "card-1", value: "1178800" }, { key: "master", label: "Mastercard", color: "card-2", value: "1640500" }]} />
            {cards.map((card, index) => <div key={card.key} className={index > 0 ? "ui:flex ui:items-center ui:justify-between ui:gap-3 ui:border-t ui:border-field-border ui:pt-3.5" : "ui:flex ui:items-center ui:justify-between ui:gap-3"}>
              <span className="ui:flex ui:items-center ui:gap-2.5"><CardDot color={card.color} /><span>{card.name}<span className="ui:block ui:text-support ui:text-text-3">···· {card.last4}</span></span></span>
              <span className="ui:flex ui:flex-col ui:items-end"><Amount size="sm" value={index ? "1640500" : "1178800"} currency="COP" second={index ? { value: "9", currency: "USD" } : null} stacked /><Button variant="link">Registrar pago</Button></span>
            </div>)}
          </div>
        </div>
      </HeroPanel>
    </Example>

    <Example title="Vacío principal"><EmptyState title="Agrega tu primera tarjeta" action={<ButtonLink href={v2Routes.newCard} variant="primary">Agregar tarjeta</ButtonLink>} /></Example>
    <Example title="Lista vacía"><EmptyState text="Sin suscripciones" action={<Link href={v2Routes.subscriptions} className="ui:text-support">Agregar</Link>} /></Example>
    <Example title="Error de carga"><EmptyState text="No pudimos cargar esta pantalla" action={<Button>Reintentar</Button>} /></Example>
    <Example title="Cargando"><Box><Skeleton className="ui:h-3.5 ui:w-[35%]" /><Skeleton className="ui:h-10 ui:w-[60%]" /><Skeleton className="ui:h-3 ui:w-[80%]" /><Skeleton className="ui:h-3 ui:w-[70%]" /></Box></Example>

    <Example title="Alertas">
      <div className="ui:flex ui:flex-col ui:gap-3">
        <Alert tone="danger" title="Pago vencido" action={<Link href={v2Routes.month("2026-11")}>Ver noviembre</Link>}>Visa · {formatMoney("1178800", "COP")}</Alert>
        <Alert tone="warning" title="Vence en 3 días" action={<Link href={v2Routes.cards}>Registrar pago</Link>}>Mastercard · {formatMoney("1640500", "COP")}</Alert>
        <Alert title="Falta la TRM de hoy" action={<Link href={v2Routes.month("2026-12")}>Ver detalle</Link>}>2 cobros en dólares sin equivalente</Alert>
      </div>
    </Example>
    <Example title="Campo con error">
      <Box><Field id={id("valor")} label="Valor" error="Escribe un valor mayor a 0"><AmountInput id={id("valor")} defaultValue="0" aria-invalid aria-describedby={describedBy(id("valor"), undefined, "error")} /></Field></Box>
    </Example>
    <Example title="Ayuda a demanda">
      <Box><span className="ui:flex ui:items-center ui:gap-2">Compras de diciembre<InfoTip>Según la fecha de compra, no la de pago.</InfoTip></span></Box>
    </Example>
    <Example title="Confirmación"><Box><span className="ui:self-start"><Toast>Movimiento guardado</Toast></span></Box></Example>
    <Example title="Etiquetas">
      <Box><div className="ui:flex ui:flex-wrap ui:items-center ui:gap-2">
        <Chip variant="paid">Pagado</Chip><Chip variant="due">Por pagar</Chip><Chip variant="warning">Vence en 3 días</Chip><Chip variant="danger">Vencido</Chip>
        <Chip variant="estimated">Estimado</Chip><Chip variant="estimated">Previsto</Chip><Chip variant="estimated">Abierto</Chip><Chip variant="estimated">Sin conciliar</Chip>
        <Chip variant="paid">Cuadra</Chip><Chip>36 cuotas</Chip><Chip>Sin extractos</Chip><Chip variant="warning">Revisar</Chip><Chip variant="paid">Conciliado</Chip><Chip variant="estimated">Supuesto</Chip>
      </div></Box>
    </Example>
    <Example title="Sin resultados"><EmptyState text="Sin movimientos con estos filtros" action={<ButtonLink href={v2Routes.movements()}>Limpiar filtros</ButtonLink>} /></Example>
    <Example title="Extracto abierto"><Box centered><span>Corta el 15 dic</span><span className="ui:text-support ui:text-text-3">Podrás registrar pagos cuando corte</span></Box></Example>
    <Example title="Eliminar">
      <Box>
        <span>¿Eliminar este movimiento?</span>
        <span className="ui:text-support ui:text-text-2">Tiene 11 cuotas y un abono; se eliminan también.</span>
        <div className="ui:flex ui:items-center ui:gap-4"><Button variant="danger">Eliminar</Button><Button variant="link">Cancelar</Button></div>
      </Box>
    </Example>
    <Example title="Menús">
      <Box><div className="ui:flex ui:flex-wrap ui:items-center ui:gap-6">
        <span className="ui:flex ui:items-center ui:gap-2 ui:text-support ui:text-text-3">Extracto<Menu label="Más opciones del extracto"><MenuItem>Marcar pagado</MenuItem><MenuItem>Deshacer pagado</MenuItem><MenuItem>Conciliar</MenuItem><MenuItem>Reabrir</MenuItem></Menu></span>
        <span className="ui:flex ui:items-center ui:gap-2 ui:text-support ui:text-text-3">Suscripción<Menu label="Más opciones de la suscripción"><MenuItem>Editar</MenuItem><MenuItem>Pausar</MenuItem><MenuItem>Reactivar</MenuItem><MenuItem danger>Cancelar</MenuItem></Menu></span>
        <span className="ui:flex ui:items-center ui:gap-2 ui:text-support ui:text-text-3">Borrador<Menu label="Más opciones del borrador"><MenuItem>Editar todo</MenuItem><MenuItem>Es el mismo</MenuItem><MenuItem danger>Descartar</MenuItem></Menu></span>
      </div></Box>
    </Example>

    <Example title="Botones">
      <Box><div className="ui:flex ui:flex-wrap ui:items-center ui:gap-3">
        <Button variant="primary">Registrar pago</Button><Button variant="soft">Nuevo gasto</Button><Button>Ver extracto</Button><Button variant="danger">Eliminar</Button><Button variant="link">Conciliar</Button>
      </div></Box>
    </Example>
    <Example title="Montos">
      <Box>
        <Amount size="lg" value="4180300" currency="COP" second={{ value: "148.2", currency: "USD" }} />
        <Amount size="md" value="982400" currency="COP" second={{ value: "7.6", currency: "USD" }} />
        <Amount value="9" currency="USD" equivalent="37800" />
      </Box>
    </Example>

    <Panel title="Tarjetas" titleId={id("tarjetas")} actions={<span className="ui:inline-flex ui:items-center ui:gap-2 ui:text-support ui:text-text-2">Cupo usado<InfoTip>Saldo usado de todas tus tarjetas, incluidas las archivadas con saldo.</InfoTip><Amount value="8026100" currency="COP" second={{ value: "148.2", currency: "USD" }} /></span>}>
      {cards.map((card, index) => <div key={card.key} className={index > 0 ? "ui:flex ui:flex-col ui:gap-2 ui:border-t ui:border-line ui:pt-4" : "ui:flex ui:flex-col ui:gap-2"}>
        <div className="ui:flex ui:items-baseline ui:justify-between ui:gap-3">
          <span className="ui:flex ui:items-center ui:gap-2"><CardDot color={card.color} size="sm" />{card.name.split(" ")[0]} ···· {card.last4}</span>
          <span><span className="ui:font-display ui:text-amount-sm ui:tabular-nums">{formatMoney(index ? "10420000" : "6154200", "COP")}</span> <span className="ui:text-support ui:text-text-3">disponibles</span></span>
        </div>
        <UtilizationBar percent={index ? 31 : 38} color={card.color} />
        <span className="ui:text-support ui:text-text-3">{index ? "31 % usado de $15.000.000" : "38 % usado de $10.000.000"}</span>
      </div>)}
    </Panel>

    <Panel title="Para atender" titleId={id("atender")} actions={<Chip>4</Chip>}>
      <RowList>
        <Row label="4 movimientos por confirmar" value={<Link href={v2Routes.drafts} className="ui:text-support">Revisar</Link>} />
        <Row label="Extracto de noviembre" detail="Mastercard" value={<Link href={v2Routes.cards} className="ui:text-support">Conciliar</Link>} />
        <Row label={`Servicio cobró ${formatMoney("86900", "COP")}`} detail={`esperado ${formatMoney("83350", "COP")}`} value={<Link href={v2Routes.drafts} className="ui:text-support">Confirmar</Link>} />
      </RowList>
    </Panel>

    <Panel title="Meses" titleId={id("meses")} className="ui:col-span-full">
      <MonthColumns columns={months} />
      <DataTable caption="Meses de pago" rows={monthRows} rowKey={(row) => row.key} columns={[
        { key: "month", header: "Mes", cell: (row) => row.month },
        { key: "state", header: "Estado", cell: (row) => row.state },
        { key: "visa", header: "Visa", align: "right", cell: (row) => formatMoney(row.visa, "COP") },
        { key: "master", header: "Mastercard", align: "right", cell: (row) => <Amount value={row.master} currency="COP" second={{ value: row.usd, currency: "USD" }} /> },
      ]} />
    </Panel>

    <Panel title="Resumen" titleId={id("resumen")}>
      <div className="ui:grid ui:grid-cols-2 ui:gap-4">
        <StatBlock label="Deuda total" value={<Amount size="md" value="4180300" currency="COP" second={{ value: "148.2", currency: "USD" }} stacked />} />
        <StatBlock label="Pago mínimo" info={<InfoTip>Incluye intereses estimados hasta que llegue el extracto del banco.</InfoTip>} value={<Amount size="md" value="1640500" currency="COP" />} hint={<Chip variant="estimated">Estimado</Chip>} />
      </div>
      <RowList>
        <Row label="Compras nuevas" value={formatMoney("312600", "COP")} />
        <Row label="Cuotas" detail="13 compras" value={<Amount value="497250" currency="COP" second={{ value: "3.54", currency: "USD" }} />} />
        <Row label={<span className="ui:inline-flex ui:items-center ui:gap-2">Intereses <Chip variant="estimated">Estimado</Chip></span>} value={formatMoney("41300", "COP")} />
      </RowList>
    </Panel>

    <Panel title="Cuotas en curso" titleId={id("cuotas")}>
      <RowList>
        <Row label="Nevera" detail="Sin intereses" value={<InstallmentProgress current={3} count={9} />} />
        <Row label="Tenis" detail="28,3 % E.A." value={<InstallmentProgress current={2} count={2} />} />
      </RowList>
    </Panel>

    <Panel title="Formulario" titleId={id("formulario")} className="ui:col-span-full">
      <div className="ui:grid ui:grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] ui:gap-4">
        <FieldGroup label="Tipo" labelId={id("tipo")}><Segmented labelledBy={id("tipo")} name="type" options={[{ value: "purchase", label: "Compra" }, { value: "cash_advance", label: "Avance" }]} /></FieldGroup>
        <Field id={id("comercio")} label="Comercio"><Input id={id("comercio")} placeholder="Ej. Éxito Laureles" /></Field>
        <Field id={id("monto")} label="Valor" hint="Se factura en dólares"><AmountInput id={id("monto")} placeholder="Ej. 81.000" aria-describedby={describedBy(id("monto"), "hint")} /></Field>
        <Field id={id("tarjeta")} label="Tarjeta"><Select id={id("tarjeta")} defaultValue="visa">{cards.map((card) => <option key={card.key} value={card.key}>{card.name.split(" ")[0]} ···· {card.last4}</option>)}</Select></Field>
        <FieldGroup label="Cuotas" labelId={id("cuotas-label")}><Stepper id={id("cuotas-campo")} label="Cuotas" defaultValue={2} /></FieldGroup>
        <FieldGroup label="Moneda" labelId={id("moneda")}><Segmented labelledBy={id("moneda")} options={[{ value: "COP", label: "COP" }, { value: "USD", label: "USD" }]} /></FieldGroup>
        <div className="ui:flex ui:items-center ui:justify-between ui:gap-3"><span>Recibir alertas de compra</span><Switch label="Recibir alertas de compra" defaultChecked /></div>
        <Checkbox label="Compra internacional" />
      </div>
      <div className="ui:flex ui:flex-wrap ui:items-center ui:gap-4">
        <Dialog title="Nueva suscripción" trigger={<button type="button" className="ui:cursor-pointer ui:bg-transparent ui:p-0 ui:text-support ui:text-primary ui:underline">Abrir diálogo</button>}
          footer={<><Button variant="primary">Guardar</Button><DialogClose>Cancelar</DialogClose></>}>
          <Field id={id("dialogo-nombre")} label="Nombre"><Input id={id("dialogo-nombre")} placeholder="Ej. Disney+" /></Field>
          <FieldGroup label="Frecuencia" labelId={id("dialogo-frecuencia")}><Segmented labelledBy={id("dialogo-frecuencia")} options={[{ value: "monthly", label: "Mensual" }, { value: "yearly", label: "Anual" }]} /></FieldGroup>
        </Dialog>
      </div>
    </Panel>
  </div>;
}
