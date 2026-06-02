// Estilo compartilhado do tooltip do Recharts.
// Fundo branco com texto escuro funciona como "card" flutuante em tema claro e escuro;
// o rótulo precisa ser escuro (o padrão do Recharts fica quase invisível no fundo branco).
export const tooltipContentStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
}

export const tooltipLabelStyle: React.CSSProperties = {
  color: '#0f172a',
  fontWeight: 600,
  marginBottom: 2,
}

export const tooltipItemStyle: React.CSSProperties = {
  color: '#0a7d52',
}
