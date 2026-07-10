/**
 * PDF Quotation Generator using pdfkit.
 *
 * Renders a professional quotation PDF matching the frontend template layout:
 *   - Business header (name, tagline, address, contact)
 *   - Client info + quote number + date
 *   - Per-unit itemised tables (panels, hardware, accessories with subtotals)
 *   - Project totals (subtotal → margin → GST → grand total)
 *   - Terms & conditions
 *   - Signature lines
 */
const PDFDocument = require('pdfkit');

// ──────────────────────────────────────────────
// Formatting helpers
// ──────────────────────────────────────────────

function formatCurrency(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN');
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ──────────────────────────────────────────────
// Main PDF generator
// ──────────────────────────────────────────────

/**
 * Generate a quote PDF and pipe it to the given writable stream.
 *
 * @param {object} project - Project row
 * @param {Array} unitBreakdowns - Array of { unit, panels, hardware, accessories, breakdown }
 * @param {object} projectTotals - { project_subtotal, margin_pct, margin_amount, gst_pct, gst_amount, grand_total }
 * @param {object} settings - Parsed settings object
 * @param {WritableStream} outputStream - HTTP response or file stream
 */
function generateQuotePdf(project, unitBreakdowns, projectTotals, settings, outputStream) {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true,
    });

    doc.pipe(outputStream);

    const pageWidth = doc.page.width - 100; // margins
    const leftMargin = 50;

    // Colours from the design system
    const PRIMARY = '#8d4b00';
    const TEXT_DARK = '#1a1b22';
    const TEXT_MUTED = '#554336';
    const BORDER = '#dbc2b0';
    const BG_LIGHT = '#f4f2fd';

    // ── Business Header ──
    const businessName = settings.business_name || 'UKD Industries';
    const tagline = settings.business_tagline || 'Premium Woodwork Solutions';
    const address = settings.business_address || '';
    const phone = settings.business_phone || '';
    const email = settings.business_email || '';

    doc.fontSize(28).font('Helvetica-Bold').fillColor(PRIMARY).text(businessName, leftMargin, 50);
    doc.fontSize(11).font('Helvetica').fillColor(TEXT_MUTED).text(tagline, leftMargin, 82);

    if (address) {
        doc.fontSize(9).fillColor(TEXT_MUTED);
        const addrLines = address.split('\\n');
        let ay = 100;
        addrLines.forEach(line => {
            doc.text(line, leftMargin, ay);
            ay += 12;
        });
        if (email || phone) {
            const contactLine = [email, phone].filter(Boolean).join(' | ');
            doc.text(contactLine, leftMargin, ay);
        }
    }

    // Quote info (right side)
    const rightX = leftMargin + pageWidth - 200;
    doc.fontSize(20).font('Helvetica-Bold').fillColor(TEXT_DARK).text('QUOTATION', rightX, 50, { width: 200, align: 'right' });
    doc.fontSize(10).font('Helvetica').fillColor(TEXT_MUTED);
    doc.text(`Quote #: ${project.quote_no}`, rightX, 78, { width: 200, align: 'right' });
    doc.text(`Date: ${formatDate(project.date)}`, rightX, 92, { width: 200, align: 'right' });
    doc.text(`Valid Until: 30 days`, rightX, 106, { width: 200, align: 'right' });

    // Divider
    doc.moveTo(leftMargin, 135).lineTo(leftMargin + pageWidth, 135).strokeColor(BORDER).lineWidth(1).stroke();

    // ── Client Information ──
    let yPos = 150;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_MUTED).text('BILL TO', leftMargin, yPos);
    yPos += 16;
    doc.fontSize(12).font('Helvetica-Bold').fillColor(TEXT_DARK).text(project.client_name, leftMargin, yPos);
    yPos += 20;

    // Project details (right column)
    doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_MUTED).text('PROJECT DETAILS', leftMargin + pageWidth / 2, 150);
    doc.fontSize(10).font('Helvetica').fillColor(TEXT_DARK);
    doc.text(`Units: ${unitBreakdowns.length}`, leftMargin + pageWidth / 2, 166);
    doc.text(`Unit System: ${project.unit_system}`, leftMargin + pageWidth / 2, 180);

    yPos = 200;

    // ── Per-Unit Itemised Sections ──
    unitBreakdowns.forEach((ub, idx) => {
        // Check if we need a new page
        if (yPos > 680) {
            doc.addPage();
            yPos = 50;
        }

        const { unit, panels, hardware, accessories, breakdown } = ub;

        // Unit header
        doc.fontSize(13).font('Helvetica-Bold').fillColor(PRIMARY);
        doc.text(`Unit ${idx + 1}: ${unit.name}`, leftMargin, yPos);
        yPos += 8;

        doc.fontSize(9).font('Helvetica').fillColor(TEXT_MUTED);
        doc.text(`Type: ${unit.type} | Finish: ${unit.finish} | Wastage: ${unit.wastage_pct}%`, leftMargin, yPos);
        yPos += 18;

        // ── Panels sub-table ──
        if (panels.length > 0) {
            doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK).text('Panels', leftMargin, yPos);
            yPos += 14;

            // Table header
            const colWidths = [200, 70, 70, 70, 80];
            const headers = ['Name', 'L (ft)', 'W (ft)', 'Qty', 'Area (sqft)'];

            doc.fontSize(8).font('Helvetica-Bold').fillColor(TEXT_MUTED);
            let xOff = leftMargin;
            headers.forEach((h, i) => {
                doc.text(h, xOff, yPos, { width: colWidths[i], align: i > 0 ? 'right' : 'left' });
                xOff += colWidths[i];
            });
            yPos += 14;
            doc.moveTo(leftMargin, yPos - 2).lineTo(leftMargin + pageWidth, yPos - 2).strokeColor(BORDER).lineWidth(0.5).stroke();

            // Table rows
            doc.fontSize(9).font('Helvetica').fillColor(TEXT_DARK);
            panels.forEach(p => {
                if (yPos > 740) { doc.addPage(); yPos = 50; }
                xOff = leftMargin;
                doc.text(p.name, xOff, yPos, { width: colWidths[0] }); xOff += colWidths[0];
                doc.text(String(p.length_ft), xOff, yPos, { width: colWidths[1], align: 'right' }); xOff += colWidths[1];
                doc.text(String(p.width_ft), xOff, yPos, { width: colWidths[2], align: 'right' }); xOff += colWidths[2];
                doc.text(String(p.qty), xOff, yPos, { width: colWidths[3], align: 'right' }); xOff += colWidths[3];
                doc.text(String(p.area), xOff, yPos, { width: colWidths[4], align: 'right' });
                yPos += 14;
            });
            yPos += 4;
        }

        // ── Hardware sub-table ──
        if (hardware.length > 0) {
            if (yPos > 700) { doc.addPage(); yPos = 50; }
            doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK).text('Hardware', leftMargin, yPos);
            yPos += 14;

            const hwCols = [250, 70, 80, 90];
            const hwHeaders = ['Item', 'Qty', 'Rate (₹)', 'Total (₹)'];
            doc.fontSize(8).font('Helvetica-Bold').fillColor(TEXT_MUTED);
            let xOff = leftMargin;
            hwHeaders.forEach((h, i) => {
                doc.text(h, xOff, yPos, { width: hwCols[i], align: i > 0 ? 'right' : 'left' });
                xOff += hwCols[i];
            });
            yPos += 14;
            doc.moveTo(leftMargin, yPos - 2).lineTo(leftMargin + pageWidth, yPos - 2).strokeColor(BORDER).lineWidth(0.5).stroke();

            doc.fontSize(9).font('Helvetica').fillColor(TEXT_DARK);
            hardware.forEach(h => {
                if (yPos > 740) { doc.addPage(); yPos = 50; }
                xOff = leftMargin;
                doc.text(h.item, xOff, yPos, { width: hwCols[0] }); xOff += hwCols[0];
                doc.text(String(h.qty), xOff, yPos, { width: hwCols[1], align: 'right' }); xOff += hwCols[1];
                doc.text(formatCurrency(h.rate), xOff, yPos, { width: hwCols[2], align: 'right' }); xOff += hwCols[2];
                doc.text(formatCurrency(h.qty * h.rate), xOff, yPos, { width: hwCols[3], align: 'right' });
                yPos += 14;
            });
            yPos += 4;
        }

        // ── Accessories sub-table ──
        if (accessories.length > 0) {
            if (yPos > 700) { doc.addPage(); yPos = 50; }
            doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK).text('Accessories', leftMargin, yPos);
            yPos += 14;

            const accCols = [250, 70, 80, 90];
            const accHeaders = ['Item', 'Qty', 'Rate (₹)', 'Total (₹)'];
            doc.fontSize(8).font('Helvetica-Bold').fillColor(TEXT_MUTED);
            let xOff = leftMargin;
            accHeaders.forEach((h, i) => {
                doc.text(h, xOff, yPos, { width: accCols[i], align: i > 0 ? 'right' : 'left' });
                xOff += accCols[i];
            });
            yPos += 14;
            doc.moveTo(leftMargin, yPos - 2).lineTo(leftMargin + pageWidth, yPos - 2).strokeColor(BORDER).lineWidth(0.5).stroke();

            doc.fontSize(9).font('Helvetica').fillColor(TEXT_DARK);
            accessories.forEach(a => {
                if (yPos > 740) { doc.addPage(); yPos = 50; }
                xOff = leftMargin;
                doc.text(a.item, xOff, yPos, { width: accCols[0] }); xOff += accCols[0];
                doc.text(String(a.qty), xOff, yPos, { width: accCols[1], align: 'right' }); xOff += accCols[1];
                doc.text(formatCurrency(a.rate), xOff, yPos, { width: accCols[2], align: 'right' }); xOff += accCols[2];
                doc.text(formatCurrency(a.qty * a.rate), xOff, yPos, { width: accCols[3], align: 'right' });
                yPos += 14;
            });
            yPos += 4;
        }

        // ── Unit Summary Box ──
        if (yPos > 680) { doc.addPage(); yPos = 50; }

        const boxX = leftMargin + pageWidth - 250;
        const boxW = 250;

        doc.rect(boxX, yPos, boxW, 100).fillColor(BG_LIGHT).fill();
        doc.fillColor(TEXT_DARK);

        const summaryLines = [
            ['Carcass Area', `${breakdown.carcass_area} sqft`],
            [`Usable Area (+${unit.wastage_pct}%)`, `${breakdown.usable_area} sqft`],
            ['Material Cost', formatCurrency(breakdown.material_cost)],
            ['Hardware Cost', formatCurrency(breakdown.hardware_cost)],
            ['Accessory Cost', formatCurrency(breakdown.accessory_cost)],
            ['Labour Cost', formatCurrency(breakdown.labour_cost)],
            ['Transport', formatCurrency(breakdown.transport)],
        ];

        let sy = yPos + 6;
        doc.fontSize(8).font('Helvetica');
        summaryLines.forEach(([label, val]) => {
            doc.fillColor(TEXT_MUTED).text(label, boxX + 8, sy, { width: 140 });
            doc.fillColor(TEXT_DARK).text(val, boxX + 148, sy, { width: 94, align: 'right' });
            sy += 12;
        });

        // Unit subtotal
        doc.moveTo(boxX + 8, sy).lineTo(boxX + boxW - 8, sy).strokeColor(BORDER).lineWidth(0.5).stroke();
        sy += 4;
        doc.fontSize(10).font('Helvetica-Bold').fillColor(PRIMARY);
        doc.text('Unit Subtotal', boxX + 8, sy, { width: 140 });
        doc.text(formatCurrency(breakdown.subtotal), boxX + 148, sy, { width: 94, align: 'right' });

        yPos = sy + 30;
    });

    // ── Project Totals ──
    if (yPos > 620) { doc.addPage(); yPos = 50; }

    doc.moveTo(leftMargin, yPos).lineTo(leftMargin + pageWidth, yPos).strokeColor(PRIMARY).lineWidth(2).stroke();
    yPos += 16;

    const totX = leftMargin + pageWidth - 280;
    const totW = 280;

    const totLines = [
        ['Project Subtotal', formatCurrency(projectTotals.project_subtotal)],
        [`Margin (${projectTotals.margin_pct}%)`, formatCurrency(projectTotals.margin_amount)],
        [`GST (${projectTotals.gst_pct}%)`, formatCurrency(projectTotals.gst_amount)],
    ];

    doc.fontSize(11).font('Helvetica');
    totLines.forEach(([label, val]) => {
        doc.fillColor(TEXT_MUTED).text(label, totX, yPos, { width: 160 });
        doc.fillColor(TEXT_DARK).text(val, totX + 160, yPos, { width: 120, align: 'right' });
        yPos += 18;
    });

    doc.moveTo(totX, yPos).lineTo(totX + totW, yPos).strokeColor(TEXT_DARK).lineWidth(1.5).stroke();
    yPos += 8;

    doc.fontSize(16).font('Helvetica-Bold').fillColor(PRIMARY);
    doc.text('Grand Total', totX, yPos, { width: 160 });
    doc.text(formatCurrency(projectTotals.grand_total), totX + 160, yPos, { width: 120, align: 'right' });
    yPos += 34;

    // ── Terms & Conditions ──
    if (yPos > 650) { doc.addPage(); yPos = 50; }

    doc.moveTo(leftMargin, yPos).lineTo(leftMargin + pageWidth, yPos).strokeColor(BORDER).lineWidth(0.5).stroke();
    yPos += 12;

    doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_MUTED).text('TERMS & CONDITIONS', leftMargin, yPos);
    yPos += 16;

    const terms = settings.terms_and_conditions || '1. Quote valid for 30 days.\n2. 50% advance payment required.';
    const termLines = terms.split('\\n');
    doc.fontSize(8).font('Helvetica').fillColor(TEXT_MUTED);
    termLines.forEach(line => {
        if (yPos > 750) { doc.addPage(); yPos = 50; }
        doc.text(line, leftMargin, yPos, { width: pageWidth });
        yPos += 12;
    });

    // ── Signature Lines ──
    if (yPos > 680) { doc.addPage(); yPos = 50; }
    yPos += 20;

    const sigWidth = pageWidth / 2 - 20;

    // Client signature
    doc.moveTo(leftMargin, yPos + 30).lineTo(leftMargin + sigWidth, yPos + 30).strokeColor(TEXT_DARK).lineWidth(0.5).stroke();
    doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_MUTED);
    doc.text('Client Signature', leftMargin, yPos + 36);
    doc.fontSize(8).font('Helvetica').text('Date: ________________', leftMargin, yPos + 50);

    // Authorized representative
    const sigRightX = leftMargin + pageWidth / 2 + 20;
    doc.fontSize(11).font('Helvetica-Oblique').fillColor(PRIMARY).text(businessName, sigRightX, yPos + 16, { width: sigWidth });
    doc.moveTo(sigRightX, yPos + 30).lineTo(sigRightX + sigWidth, yPos + 30).strokeColor(TEXT_DARK).lineWidth(0.5).stroke();
    doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_MUTED);
    doc.text('Authorized Representative', sigRightX, yPos + 36);
    doc.fontSize(8).font('Helvetica').text(`Date: ${formatDate(project.date)}`, sigRightX, yPos + 50);

    doc.end();
}

module.exports = { generateQuotePdf };
