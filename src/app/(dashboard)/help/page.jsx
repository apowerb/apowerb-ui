import { redirect } from "next/navigation";

// Help a fusionne dans la Tool Box (onglet Help). On redirige les anciens liens.
export default function Help() {
  redirect("/tool-box#help");
}
