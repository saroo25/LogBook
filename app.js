const STORAGE_KEY = "scuba-logbook-dives";
const TEMPLATE_PATH = "modello_dive_log_subacquea.pdf";

const emptyDive = (index) => ({
  number: String(index),
  date: "",
  location: "",
  site: "",
  entryTime: "",
  exitTime: "",
  maxDepth: "",
  bottomTime: "",
  waterTemp: "",
  pressureIn: "",
  pressureOut: "",
  mix: "",
  weight: "",
  suit: "",
  visibility: "",
  notes: "",
  buddySignature: "",
  centerStamp: "",
});

const coords = {
  first: {
    number: [55, 689, 13, 112],
    date: [440, 699, 9, 78],
    location: [109, 648, 10, 332],
    site: [109, 616, 10, 332],
    entryTime: [490, 648, 10, 62],
    exitTime: [490, 616, 10, 62],
    maxDepth: [109, 578, 10, 70],
    bottomTime: [323, 578, 10, 78],
    waterTemp: [490, 578, 10, 62],
    pressureIn: [109, 533, 10, 70],
    pressureOut: [323, 533, 10, 78],
    mix: [490, 533, 10, 62],
    weight: [109, 493, 10, 70],
    suit: [323, 493, 10, 78],
    visibility: [490, 493, 10, 70],
    notes: [59, 439, 9.5, 485, 5],
    buddySignature: [109, 351, 10, 190],
    centerStamp: [380, 357, 10, 130],
  },
  repeat: {
    number: [55, 755, 13, 112],
    date: [440, 766, 9, 78],
    location: [109, 715, 10, 332],
    site: [109, 683, 10, 332],
    entryTime: [490, 715, 10, 62],
    exitTime: [490, 683, 10, 62],
    maxDepth: [109, 644, 10, 70],
    bottomTime: [323, 644, 10, 78],
    waterTemp: [490, 644, 10, 62],
    pressureIn: [109, 600, 10, 70],
    pressureOut: [323, 600, 10, 78],
    mix: [490, 600, 10, 62],
    weight: [109, 560, 10, 70],
    suit: [323, 560, 10, 78],
    visibility: [490, 560, 10, 70],
    notes: [59, 506, 9.5, 485, 5],
    buddySignature: [109, 418, 10, 190],
    centerStamp: [380, 424, 10, 130],
  },
};

let dives = loadDives();

const form = document.querySelector("#divesForm");
const template = document.querySelector("#diveTemplate");
const statusEl = document.querySelector("#status");

document.querySelector("#addDive").addEventListener("click", addDive);
document.querySelector("#addDiveTop").addEventListener("click", addDive);
document.querySelector("#downloadPdf").addEventListener("click", generatePdf);
document.querySelector("#resetAll").addEventListener("click", resetAll);

form.addEventListener("input", (event) => {
  const input = event.target.closest("[data-field]");
  if (!input) return;

  const card = input.closest(".dive-card");
  const diveIndex = Number(card.dataset.index);
  dives[diveIndex][input.dataset.field] = input.value;
  saveDives();
});

form.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-dive");
  if (!button) return;

  const card = button.closest(".dive-card");
  const diveIndex = Number(card.dataset.index);
  if (dives.length === 1) {
    dives = [emptyDive(1)];
  } else {
    dives.splice(diveIndex, 1);
  }
  saveDives();
  render();
});

render();

function loadDives() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) && stored.length ? stored : [emptyDive(1)];
  } catch {
    return [emptyDive(1)];
  }
}

function saveDives() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dives));
}

function addDive() {
  dives.push(emptyDive(nextDiveNumber()));
  saveDives();
  render();
  setStatus("Nuova pagina aggiunta.");
}

function resetAll() {
  const confirmed = window.confirm("Vuoi svuotare tutte le schede compilate?");
  if (!confirmed) return;

  dives = [emptyDive(1)];
  saveDives();
  render();
  setStatus("Schede svuotate.");
}

function nextDiveNumber() {
  const numbers = dives
    .map((dive) => Number.parseInt(dive.number, 10))
    .filter(Number.isFinite);
  return numbers.length ? Math.max(...numbers) + 1 : dives.length + 1;
}

function render() {
  form.replaceChildren();

  dives.forEach((dive, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.index = String(index);
    node.querySelector(".card-kicker").textContent =
      index === 0 ? "Pagina iniziale" : `Pagina aggiunta ${index + 1}`;
    node.querySelector("h3").textContent =
      index === 0 ? "Dati generali immersione" : `Immersione ${index + 1}`;
    node.querySelector(".remove-dive").hidden = dives.length === 1;

    node.querySelectorAll("[data-field]").forEach((field) => {
      field.value = dive[field.dataset.field] ?? "";
    });

    form.appendChild(node);
  });
}

async function generatePdf() {
  if (!window.PDFLib) {
    setStatus("La libreria PDF non è stata caricata. Controlla la connessione.");
    return;
  }

  setStatus("Genero il PDF...");

  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const templateBytes = await fetch(TEMPLATE_PATH).then((response) => {
      if (!response.ok) throw new Error("Template PDF non trovato.");
      return response.arrayBuffer();
    });

    const templatePdf = await PDFDocument.load(templateBytes);
    const outputPdf = await PDFDocument.create();
    const regular = await outputPdf.embedFont(StandardFonts.Helvetica);
    const bold = await outputPdf.embedFont(StandardFonts.HelveticaBold);
    const color = rgb(0.08, 0.14, 0.23);
    const accent = rgb(0.05, 0.22, 0.42);

    for (const [index, dive] of dives.entries()) {
      const sourcePageIndex = index === 0 ? 0 : 1;
      const [page] = await outputPdf.copyPages(templatePdf, [sourcePageIndex]);
      outputPdf.addPage(page);
      drawDive(page, dive, index === 0 ? coords.first : coords.repeat, {
        regular,
        bold,
        color,
        accent,
      });
    }

    const bytes = await outputPdf.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `logbook-subacqueo-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`PDF generato con ${dives.length} pagina/e.`);
  } catch (error) {
    console.error(error);
    setStatus(`Errore: ${error.message}`);
  }
}

function drawDive(page, dive, map, fontBag) {
  drawSingle(page, dive.number, map.number, fontBag.bold, fontBag.accent);
  drawSingle(page, formatDate(dive.date), map.date, fontBag.regular, fontBag.color);
  drawSingle(page, dive.location, map.location, fontBag.regular, fontBag.color);
  drawSingle(page, dive.site, map.site, fontBag.regular, fontBag.color);
  drawSingle(page, dive.entryTime, map.entryTime, fontBag.regular, fontBag.color);
  drawSingle(page, dive.exitTime, map.exitTime, fontBag.regular, fontBag.color);
  drawSingle(page, dive.maxDepth, map.maxDepth, fontBag.regular, fontBag.color);
  drawSingle(page, dive.bottomTime, map.bottomTime, fontBag.regular, fontBag.color);
  drawSingle(page, dive.waterTemp, map.waterTemp, fontBag.regular, fontBag.color);
  drawSingle(page, dive.pressureIn, map.pressureIn, fontBag.regular, fontBag.color);
  drawSingle(page, dive.pressureOut, map.pressureOut, fontBag.regular, fontBag.color);
  drawSingle(page, dive.mix, map.mix, fontBag.regular, fontBag.color);
  drawSingle(page, dive.weight, map.weight, fontBag.regular, fontBag.color);
  drawSingle(page, dive.suit, map.suit, fontBag.regular, fontBag.color);
  drawSingle(page, dive.visibility, map.visibility, fontBag.regular, fontBag.color);
  drawMultiline(page, dive.notes, map.notes, fontBag.regular, fontBag.color);
  drawSingle(page, dive.buddySignature, map.buddySignature, fontBag.regular, fontBag.color);
  drawSingle(page, dive.centerStamp, map.centerStamp, fontBag.regular, fontBag.color);
}

function drawSingle(page, value, config, font, color) {
  const [x, y, size, maxWidth] = config;
  const text = fitText(safeText(value), font, size, maxWidth);
  if (!text) return;

  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
  });
}

function drawMultiline(page, value, config, font, color) {
  const [x, y, size, maxWidth, maxLines] = config;
  const lines = wrapText(safeText(value), font, size, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * (size + 4),
      size,
      font,
      color,
    });
  });
}

function wrapText(text, font, size, maxWidth) {
  if (!text) return [];

  const words = text.split(/\s+/);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      return;
    }

    if (line) lines.push(line);
    line = fitText(word, font, size, maxWidth);
  });

  if (line) lines.push(line);
  return lines;
}

function fitText(text, font, size, maxWidth) {
  if (!text) return "";
  let output = text;

  while (font.widthOfTextAtSize(output, size) > maxWidth && output.length > 1) {
    output = output.slice(0, -1);
  }

  return output === text ? output : `${output.slice(0, -3)}...`;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day} / ${month} / ${year}`;
}

function safeText(value) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7EÀ-ÿ]/g, "")
    .trim();
}

function setStatus(message) {
  statusEl.textContent = message;
}
