import type { FontePerfil } from './tipos.js'
import { PerfilCamara } from './perfilCamara.js'
import { PerfilSenado } from './perfilSenado.js'

const camara = new PerfilCamara()
const senado = new PerfilSenado()

export function fontePerfilDaCasa(casa: 'camara' | 'senado'): FontePerfil {
  return casa === 'camara' ? camara : senado
}
