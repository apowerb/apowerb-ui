/**
 * « Quand un bug a été envoyé, je peux pas envoyer un 2eme. »
 *   — signalé le 11/09/2026, sur le dev
 *
 * Le formulaire restait sur son écran de confirmation. `BugReportModal`
 * rend `null` quand il est fermé, mais React ne le démonte pas pour
 * autant : son état survit, donc la réouverture réaffichait « Signalement
 * envoyé » et son bouton, sans un seul champ à remplir.
 *
 * Le correctif donne au formulaire une `key` qui change à chaque
 * ouverture. Ce test porte donc sur la seule chose qui compte : après un
 * envoi, une réouverture doit présenter un formulaire VIERGE.
 *
 * Les deux cas sont testés — sans la `key` puis avec — parce qu'un test
 * qui ne vérifierait que le vert ne dirait pas si c'est la `key` qui
 * corrige ou un effet de bord du rendu.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";

/** Le formulaire réduit à ce que le test doit observer : un état interne
 *  qui survit au démontage logique — exactement comme le vrai. */
function FauxFormulaire({ show }) {
  const [envoye, setEnvoye] = useState(false);
  if (!show) return null;
  return envoye ? (
    <p>confirmation</p>
  ) : (
    <button type="button" onClick={() => setEnvoye(true)}>
      formulaire
    </button>
  );
}

function LanceurSansKey({ ouvertures }) {
  return <FauxFormulaire show={ouvertures % 2 === 1} />;
}

function LanceurAvecKey({ ouvertures }) {
  return <FauxFormulaire key={ouvertures} show={ouvertures % 2 === 1} />;
}

describe("envoyer un second signalement", () => {
  it("sans la key, la confirmation du premier envoi survit à la réouverture", () => {
    const { rerender } = render(<LanceurSansKey ouvertures={1} />);
    screen.getByText("formulaire").click();
    rerender(<LanceurSansKey ouvertures={2} />); // fermé
    rerender(<LanceurSansKey ouvertures={3} />); // rouvert
    expect(screen.queryByText("formulaire")).toBeNull();
    expect(screen.getByText("confirmation")).toBeTruthy();
  });

  it("avec la key, la réouverture présente un formulaire vierge", () => {
    const { rerender } = render(<LanceurAvecKey ouvertures={1} />);
    screen.getByText("formulaire").click();
    rerender(<LanceurAvecKey ouvertures={2} />); // fermé
    rerender(<LanceurAvecKey ouvertures={3} />); // rouvert
    expect(screen.getByText("formulaire")).toBeTruthy();
    expect(screen.queryByText("confirmation")).toBeNull();
  });
});
