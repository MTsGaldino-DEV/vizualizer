/** Wordmark: viz + u (a toca do Vizu) + alizer, Syne ExtraBold, tracking −5%. */
export function Logo({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <span
      className="inline-flex items-end font-display font-extrabold leading-none tracking-[-0.05em] text-texto"
      style={{ fontSize: tamanho }}
      aria-label="Vizualizer"
    >
      <span aria-hidden>viz</span>
      <img src="/marca/vizu-toca-u.svg" alt="" aria-hidden style={{ width: tamanho * 0.78, height: tamanho * 0.78, marginBottom: tamanho * 0.02 }} />
      <span aria-hidden>alizer</span>
    </span>
  );
}
