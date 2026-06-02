import { Disclaimer } from './Disclaimer'

export function Rodape() {
  return (
    <footer className="mt-20 border-t border-borda">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <Disclaimer />
        <p className="mt-2 text-xs text-tinta-tenue">
          Projeto aberto · dados de transparência pública · feito para fiscalização cidadã.
        </p>
      </div>
    </footer>
  )
}
