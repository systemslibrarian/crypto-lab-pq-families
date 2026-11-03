/** Conceptual dependency audit, not a proof-system implementation or certification. */
export function renderProofWrapper(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'lab-section';
  section.innerHTML = `
    <div class="section-heading-row"><div>
      <p class="section-kicker">Follow the verification path</p>
      <h2>A post-quantum signature inside a classical proof</h2>
      <p class="panel-copy">Which assumptions does the receiver actually rely on? A signature label alone cannot answer that.</p>
    </div></div>
    <p>The ZKS-PQC V2X prototype combines PQ signatures with classical Bulletproofs. Its authors explicitly acknowledge that the proof system is not post-quantum. This diagram is a teaching audit of the dependencies to check, not a reconstruction or validation of their implemented circuit.</p>
    <figure class="proof-map">
      <figcaption>Serial wrapper: the receiver accepts a proof about signature verification</figcaption>
      <div class="proof-map-grid">
        <div class="proof-node"><strong>Public statement and trust</strong><p>Bind the message, certificate/public key, protocol context and intended identity. Check the certificate chain and trust anchor.</p><p>Required by ↓</p></div>
        <div class="proof-node"><strong>Signature relation</strong><p>The proved relation must enforce Verify(pk, message, signature) = true for the intended algorithm and the bound inputs.</p><p>Required by ↓</p></div>
        <div class="proof-node proof-wide"><strong>Commitment and transcript</strong><p>Bind the witness and statement; check commitment assumptions, challenge derivation and domain separation. Hiding alone does not establish soundness.</p><p>Required by ↓</p></div>
        <div class="proof-node proof-wide"><strong>Proof verifier → acceptance</strong><p>The receiver relies on proof soundness to conclude the signature relation holds. A PQ signature cannot repair a forged proof about that relation.</p></div>
      </div>
    </figure>
    <label for="proof-case"><strong>Compare a design change</strong></label>
    <select id="proof-case">
      <option value="signature">Change only the signature to ML-DSA</option>
      <option value="proof">Also propose a post-quantum proof system</option>
      <option value="parallel">Compare direct dual-signature verification</option>
    </select>
    <div class="callout" id="proof-result" role="status" aria-atomic="true"></div>
    <p>Neither “every composition inherits its weakest part” nor “either secure component always suffices” is a universal rule. Write down the acceptance rule and the security property first. A key-exchange combiner needs its own analysis; it is not this signature example.</p>
    <p>Source: <a href="https://arxiv.org/abs/2610.11490v1">Yoshizawa et al., arXiv:2610.11490v1</a>, §§IV–V, especially §V.E (PDF pp. 5–6, 11–12). Read the authors’ limitation alongside the performance figures. See also <a href="https://systemslibrarian.github.io/crypto-lab-point-ledger/">Point Ledger</a> for proof and commitment concepts.</p>`;
  const control = section.querySelector<HTMLSelectElement>('#proof-case')!;
  const result = section.querySelector<HTMLDivElement>('#proof-result')!;
  const cases: Record<string, string> = {
    signature: `<h3>Classical proof dependency remains</h3><p>Replacing a signature with ML-DSA leaves the Bulletproofs discrete-log assumptions in the receiver’s acceptance path. The whole wrapper has not become post-quantum.</p>`,
    proof: `<h3>Candidate replacement — still requires review</h3><p>A PQ proof system removes this particular classical dependency only if its concrete construction and parameters meet the required security model. Recheck soundness, commitments, Fiat–Shamir transcript, message/key binding and the certificate trust path. This selection does not certify any construction or predict its performance.</p>`,
    parallel: `<h3>Parallel example: require BOTH signatures</h3><p>The receiver directly verifies a classical signature AND a PQ signature on the same unambiguous message and context, with both keys authenticated to the same identity. A new-message forgery must satisfy both checks. Under an appropriate robust composition argument, one unforgeable component can still block it if the other breaks.</p><p>That conditional argument also needs downgrade resistance, correct key binding and implementation. Accepting EITHER signature instead lets a broken component authorize a forgery. This is a contrasting design, not a claim that the paper’s wrapper implements a robust hybrid.</p>`,
  };
  const update = () => { result.innerHTML = cases[control.value] ?? cases.signature!; };
  control.addEventListener('change', update);
  update();
  return section;
}
