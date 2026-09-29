import React, { useState } from "react";
import { Download, FileText, Printer, ChevronDown } from "lucide-react";
import { useToast } from "../lib/toast";
import { buildPrintHtml } from "../lib/exportHtml";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";

interface ExportButtonProps {
  data: any[];
  columns: { key: string; label: string; format?: (val: any) => string }[];
  filename: string;
  title: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  data,
  columns,
  filename,
  title,
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const generateDocx = async () => {
    if (!data.length) {
      toast.error("No data to export");
      return;
    }

    const headers = columns.map((c) => c.label);
    const rows = data.map((row) =>
      columns.map((c) => {
        let val = row[c.key];
        if (val === null || val === undefined) val = "";
        if (c.format) val = c.format(val);
        return String(val);
      }),
    );

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: title, bold: true, size: 32 })],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Exported on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
                  italics: true,
                  size: 20,
                }),
              ],
            }),
            new Paragraph({ children: [] }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: headers.map(
                    (h) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: h, bold: true })],
                          }),
                        ],
                      }),
                  ),
                }),
                ...rows.map(
                  (r) =>
                    new TableRow({
                      children: r.map(
                        (cell) =>
                          new TableCell({
                            children: [
                              new Paragraph({ children: [new TextRun(cell)] }),
                            ],
                          }),
                      ),
                    }),
                ),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.docx`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Word document exported successfully");
    setOpen(false);
  };

  const printPDF = () => {
    // noopener severs window.opener, so the print document cannot reach back
    // into this window and read the JWT out of localStorage.
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast.error("Pop-up blocked. Please allow pop-ups.");
      return;
    }

    printWindow.document.write(
      buildPrintHtml({ title, data, columns }),
    );
    printWindow.document.close();
    setOpen(false);
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-[#0037b0] border border-[#c4c5d7] rounded-lg hover:bg-[#dce1ff]/20 hover:border-[#0037b0] transition-colors"
      >
        <Download className="w-3 h-3" /> Export{" "}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 mt-1 bg-white border border-[#c4c5d7] rounded-lg shadow-lg z-50 py-1 min-w-35" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
            <button
              onClick={generateDocx}
              role="menuitem"
              className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" /> Word Document
            </button>
            <button
              onClick={printPDF}
              role="menuitem"
              className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Printer className="w-3.5 h-3.5 text-red-600" /> PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
};
