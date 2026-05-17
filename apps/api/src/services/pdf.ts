import fs from 'node:fs';
import PDFDocument from 'pdfkit';

export function createPdfFromText(outputPath: string, title: string, body: string) {
  return new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);
    doc.fontSize(20).text(title);
    doc.moveDown();
    doc.fontSize(12).text(body);
    doc.end();

    stream.on('finish', () => resolve());
    stream.on('error', (err) => reject(err));
  });
}
