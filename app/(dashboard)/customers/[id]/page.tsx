import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getPlanAccess } from '@/lib/plan-access'
import { getCustomerProfile } from '@/actions/customers'
import { formatPhoneDisplay } from '@/lib/utils/phone'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Star, ShoppingBag, Calendar, FileSignature } from 'lucide-react'
import { RevokeConsentButton } from '@/components/customers/revoke-consent-button'

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const access = await getPlanAccess()
  if (!access.canAccess) redirect('/settings/billing')

  const { id } = await params
  const data = await getCustomerProfile(id)
  if (!data) notFound()

  const { customer, transactions, pointsHistory, consent } = data

  const formattedPhone = formatPhoneDisplay(customer.phone)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <Link
          href="/customers"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Clientes
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            <p className="text-muted-foreground">{formattedPhone}</p>
            {customer.email && (
              <p className="text-sm text-muted-foreground">{customer.email}</p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-2xl font-bold">{customer.total_points}</span>
            </div>
            <p className="text-xs text-muted-foreground">puntos actuales</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{customer.visit_count}</p>
            <p className="text-xs text-muted-foreground">visitas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xl font-bold">${Number(customer.lifetime_spend).toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">gasto total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xl font-bold">
              {customer.visit_count > 0
                ? `$${(Number(customer.lifetime_spend) / customer.visit_count).toFixed(0)}`
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground">ticket promedio</p>
          </CardContent>
        </Card>
      </div>

      {/* Historial de transacciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historial de compras</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sin compras aún.
            </p>
          ) : (
            <div className="divide-y">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {tx.ticket_number ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString('es-MX', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="font-semibold">${Number(tx.total).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consentimiento legal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Consentimiento y firma
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!consent ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Este cliente no tiene consentimiento digital registrado.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={consent.revoked_at ? 'destructive' : 'default'}>
                  {consent.revoked_at ? 'Revocado' : 'Firmado'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(consent.signed_at).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="text-sm space-y-0.5">
                <p>
                  <span className="text-muted-foreground">Firmante:</span>{' '}
                  <span className="font-medium">{consent.signer_name_typed}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Teléfono:</span>{' '}
                  <span className="font-medium">{formatPhoneDisplay(consent.signer_phone)}</span>
                </p>
                {consent.contract_snapshot_json?.documents && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Versiones legales: privacidad {consent.contract_snapshot_json.documents.privacy?.version_label ?? '—'} ·
                    términos {consent.contract_snapshot_json.documents.terms?.version_label ?? '—'} ·
                    recompensas {consent.contract_snapshot_json.documents.rewards?.version_label ?? '—'}
                  </p>
                )}
              </div>

              {consent.signature_signed_url && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Firma capturada</p>
                  <a
                    href={consent.signature_signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-xs text-primary hover:underline"
                  >
                    Ver firma
                  </a>
                </div>
              )}

              <div>
                <a
                  href={`/api/consents/${consent.id}/receipt`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-xs text-primary hover:underline"
                >
                  Descargar comprobante
                </a>
              </div>

              {!consent.revoked_at && (
                <RevokeConsentButton consentId={consent.id} customerId={customer.id} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de puntos */}
      {pointsHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Movimientos de puntos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {pointsHistory.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          p.type === 'earn' || p.type === 'welcome'
                            ? 'default'
                            : 'destructive'
                        }
                        className="text-xs"
                      >
                        {p.type === 'earn'
                          ? 'Ganó'
                          : p.type === 'redeem'
                          ? 'Canjeó'
                          : p.type === 'welcome'
                          ? 'Bienvenida'
                          : p.type}
                      </Badge>
                    </div>
                    {p.note && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.note}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('es-MX', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        p.points_delta > 0 ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {p.points_delta > 0 ? '+' : ''}{p.points_delta} pts
                    </p>
                    <p className="text-xs text-muted-foreground">
                      saldo: {p.balance_after}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info adicional */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="space-y-1.5 text-sm">
            {customer.birthday && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  Cumpleaños:{' '}
                  {new Date(customer.birthday + 'T12:00:00').toLocaleDateString('es-MX', {
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
            <p className="text-muted-foreground">
              Cliente desde{' '}
              {new Date(customer.created_at).toLocaleDateString('es-MX', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
