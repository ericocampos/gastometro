import { Disclaimer } from './Disclaimer'

export function Rodape() {
  return (
    <footer className="mt-16 border-t border-slate-200 py-6 dark:border-slate-800">
      <div className="mx-auto max-w-5xl px-4">
        <Disclaimer />
      </div>
    </footer>
  )
}
