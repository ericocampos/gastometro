// Estilo compartilhado do tooltip do Recharts.
// Usa as variáveis de tema (superfície/tinta) para combinar com claro e escuro;
// o rótulo precisa de cor explícita (o padrão do Recharts fica quase invisível).
export const tooltipContentStyle: React.CSSProperties = {
  background: 'var(--superficie)',
  border: '1px solid var(--borda)',
  borderRadius: 8,
  boxShadow: '0 8px 24px -10px rgba(0,0,0,0.35)',
}

export const tooltipLabelStyle: React.CSSProperties = {
  color: 'var(--tinta)',
  fontWeight: 600,
  marginBottom: 2,
}

export const tooltipItemStyle: React.CSSProperties = {
  color: 'var(--marca)',
}
