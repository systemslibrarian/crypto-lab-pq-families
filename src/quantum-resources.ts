/** Dated literature comparison; not a resource calculator or a Q-Day forecast. */
export function renderQuantumResources(): string {
  return `<div class="callout quantum-resources" id="quantum-resource-comparison">
    <h3>RSA-2048: two resource estimates, two time–space choices</h3>
    <div class="table-shell" role="region" tabindex="0" aria-label="RSA-2048 quantum-resource estimates">
      <table class="math-table resource-table">
        <caption>Dated estimates under stated hardware assumptions</caption>
        <thead><tr><th scope="col">Account</th><th scope="col">Gidney–Ekerå: 2019 / 2021</th><th scope="col">Gidney: 2025</th></tr></thead>
        <tbody>
          <tr><th scope="row">Source and status</th><td><a href="https://arxiv.org/abs/1905.09749v3" target="_blank" rel="noopener noreferrer">Preprint: 23 May 2019; revised 13 April 2021</a>. <a href="https://doi.org/10.22331/q-2021-04-15-433" target="_blank" rel="noopener noreferrer">Quantum publication: 15 April 2021</a>.</td><td><a href="https://arxiv.org/abs/2505.15917v1" target="_blank" rel="noopener noreferrer">Preprint: 21 May 2025, version 1</a>.</td></tr>
          <tr><th scope="row">Physical qubits</th><td data-estimate="gidney-ekera-2019">Approximately 20 million noisy qubits</td><td data-estimate="gidney-2025">897,864 before slack; approximately one million with safety slack</td></tr>
          <tr><th scope="row">Factoring runtime</th><td>Approximately 8 hours</td><td>Less than one week</td></tr>
          <tr><th scope="row">Logical accounting</th><td>Separate circuit account in the older paper; do not substitute the 2025 logical counts.</td><td><a href="https://arxiv.org/html/2505.15917v1#S3.SS2" target="_blank" rel="noopener noreferrer">§3.2:</a> 1,409 active logical qubits; 1,537 including idle hot patches.</td></tr>
        </tbody>
      </table>
    </div>
    <p>Both assume a nearest-neighbor square grid, 0.1% gate error, 1 μs surface-code cycles and 10 μs control-system reaction time. The 2025 construction saves space with different arithmetic, denser idle storage and smaller/fewer factories, at a longer runtime. Each row belongs to its own estimate.</p>
    <p>These are conditional research estimates, not hardware demonstrations, universal minima or predictions of a calendar year. Physical hardware-qubit totals cannot be compared directly with logical-qubit requirements. This browser does not factor RSA-2048.</p>
    <p>Explore the <a href="https://systemslibrarian.github.io/crypto-lab-shor/">Shor lab</a> and <a href="https://systemslibrarian.github.io/crypto-lab-point-ledger/">Point Ledger’s resource-source distinctions</a>. Reviewed 12 October 2026.</p>
  </div>`;
}
