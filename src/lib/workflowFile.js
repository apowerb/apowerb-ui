/**
 * Un workflow sous forme de fichier JSON : lecture et écriture.
 *
 * Deux formes sont acceptées à l'import — le graphe nu ({version, nodes,
 * edges}), celui que l'API stocke et que la documentation décrit, et
 * l'enveloppe qu'exporte le Studio, qui ajoute le nom et la description.
 * Exporter puis réimporter redonne donc le même workflow, nom compris, sans
 * que l'utilisateur ait à recopier quoi que ce soit.
 */

export const WORKFLOW_FILE_VERSION = 1;

/** Erreur d'import : ``code`` est une clé de WorkflowsPage, pas un texte. */
export class WorkflowFileError extends Error {
  constructor(code) {
    super(code);
    this.name = "WorkflowFileError";
    this.code = code;
  }
}

function asGraph(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null;
  return {
    version: value.version ?? WORKFLOW_FILE_VERSION,
    nodes: value.nodes,
    edges: value.edges,
  };
}

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Lit le contenu d'un fichier ; lève WorkflowFileError si ce n'en est pas un. */
export function parseWorkflowFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new WorkflowFileError("importInvalidJson");
  }
  const graph = asGraph(data) || asGraph(data?.graph);
  if (!graph) throw new WorkflowFileError("importNotAWorkflow");
  return {
    name: trimmed(data?.name),
    description: trimmed(data?.description),
    graph,
  };
}

/** L'objet écrit dans le fichier exporté. */
export function buildWorkflowFile({ name, description, graph } = {}) {
  const file = { name: trimmed(name), graph: asGraph(graph) || { version: WORKFLOW_FILE_VERSION, nodes: [], edges: [] } };
  const desc = trimmed(description);
  if (desc) file.description = desc;
  return file;
}

/** Nom de fichier lisible, sans accent ni espace. */
export function workflowFileName(name) {
  const slug = trimmed(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "workflow"}.json`;
}

/** Déclenche le téléchargement ; seul endroit qui touche au DOM. */
export function downloadWorkflowFile(file) {
  const blob = new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = workflowFileName(file?.name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
