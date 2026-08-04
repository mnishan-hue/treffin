import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Arg = { author: string; text: string; time: string };

type ExportDebateData = {
  title: string;
  description?: string | null;
  category: string;
  supportPercent: number;
  againstPercent: number;
  participantCount: number;
  supportArgs: Arg[];
  againstArgs: Arg[];
  agreements?: string[];
};

const INDIGO = [79, 106, 247] as const;
const ROSE = [251, 113, 133] as const;
const DARK_BG = [13, 24, 48] as const;
const DARK_CARD = [18, 28, 56] as const;
const MUTED = [120, 130, 160] as const;
const WHITE = [255, 255, 255] as const;
const GREEN = [52, 211, 153] as const;

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function exportDebatePDF(data: ExportDebateData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, pageW, 22, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("TREFFIN", margin, 13);

  doc.setTextColor(...INDIGO);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("WHERE MINDS DEBATE", margin + 29, 13);

  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text(
    `Exported ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    pageW - margin,
    13,
    { align: "right" }
  );

  // ── Category badge ───────────────────────────────────────────────────────────
  let y = 32;
  doc.setFillColor(...INDIGO);
  const badgeText = data.category.toUpperCase();
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const badgeW = doc.getTextWidth(badgeText) + 6;
  doc.roundedRect(margin, y - 4.5, badgeW, 5.5, 1, 1, "F");
  doc.setTextColor(...WHITE);
  doc.text(badgeText, margin + 3, y);

  // ── Debate title ─────────────────────────────────────────────────────────────
  y += 8;
  doc.setTextColor(30, 30, 50);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(data.title, contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 2;

  // ── Description ──────────────────────────────────────────────────────────────
  if (data.description) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    y = wrapText(doc, data.description, margin, y, contentW, 5) + 3;
  }

  // ── Participants ─────────────────────────────────────────────────────────────
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text(`${data.participantCount.toLocaleString()} participants`, margin, y);
  y += 8;

  // ── Vote bar ─────────────────────────────────────────────────────────────────
  const barH = 5;
  const supportW = (data.supportPercent / 100) * contentW;
  const againstW = contentW - supportW;

  doc.setFillColor(...INDIGO);
  doc.roundedRect(margin, y, supportW, barH, 1, 1, "F");
  doc.setFillColor(...ROSE);
  doc.roundedRect(margin + supportW, y, againstW, barH, 1, 1, "F");

  y += barH + 3;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INDIGO);
  doc.text(`Support ${data.supportPercent}%`, margin, y);
  doc.setTextColor(...ROSE);
  doc.text(`Against ${data.againstPercent}%`, pageW - margin, y, { align: "right" });
  y += 10;

  // ── Arguments table ──────────────────────────────────────────────────────────
  const maxRows = Math.max(data.supportArgs.length, data.againstArgs.length);
  const bodyRows: [string, string][] = [];

  for (let i = 0; i < maxRows; i++) {
    const sup = data.supportArgs[i];
    const opp = data.againstArgs[i];
    const supCell = sup ? `${sup.author}\n${sup.text}` : "";
    const oppCell = opp ? `${opp.author}\n${opp.text}` : "";
    bodyRows.push([supCell, oppCell]);
  }

  if (bodyRows.length === 0) {
    bodyRows.push(["No arguments yet.", "No arguments yet."]);
  }

  autoTable(doc, {
    startY: y,
    head: [["◆  Support Arguments", "◆  Against Arguments"]],
    body: bodyRows,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak",
      valign: "top",
      lineColor: [220, 225, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [...DARK_CARD] as [number, number, number],
      textColor: [...WHITE] as [number, number, number],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    columnStyles: {
      0: { textColor: [...INDIGO] as [number, number, number], cellWidth: contentW / 2 },
      1: { textColor: [...ROSE] as [number, number, number], cellWidth: contentW / 2 },
    },
    alternateRowStyles: {
      fillColor: [246, 247, 252],
    },
    bodyStyles: {
      textColor: [40, 45, 70],
    },
  });

  // ── Points of Agreement ───────────────────────────────────────────────────────
  const agreements = data.agreements ?? [];
  if (agreements.length > 0) {
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? 0;
    let ay = finalY + 10;

    if (ay + 20 > pageH - 20) {
      doc.addPage();
      ay = 20;
    }

    doc.setFillColor(...GREEN);
    doc.roundedRect(margin, ay - 4.5, 56, 5.5, 1, 1, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("POINTS OF AGREEMENT", margin + 3, ay);

    ay += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 45, 70);

    for (const agreement of agreements) {
      doc.setFillColor(240, 253, 244);
      const textLines = doc.splitTextToSize(`• ${agreement}`, contentW - 6);
      const cellH = textLines.length * 5 + 4;
      if (ay + cellH > pageH - 20) {
        doc.addPage();
        ay = 20;
      }
      doc.roundedRect(margin, ay - 3, contentW, cellH, 1, 1, "F");
      doc.setTextColor(22, 101, 52);
      doc.text(textLines, margin + 3, ay);
      ay += cellH + 2;
    }
  }

  // ── Footer on every page ─────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 225, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text("Generated by Treffin · treffin.replit.app", margin, pageH - 5);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  const safeName = data.title
    .replace(/[^a-z0-9\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase()
    .slice(0, 80) || "treffin_debate";
  doc.save(`${safeName}.pdf`);
}
