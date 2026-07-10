/**
 * UKD Industries — Pricing Engine
 *
 * Pure functions with ZERO database dependency.
 * All inputs are plain data objects; all outputs are numbers.
 *
 * Money  → Math.round() to whole rupees.
 * Areas  → parseFloat(x.toFixed(2)) to 2 decimal places.
 */

// ──────────────────────────────────────────────
// Unit Conversion
// ──────────────────────────────────────────────

/**
 * Convert a dimension value to feet.
 * @param {number} value
 * @param {'ft'|'inch'|'mm'} system
 * @returns {number} value in feet (2 decimals)
 */
function toFeet(value, system) {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new Error(`toFeet: invalid value "${value}"`);
    }
    switch (system) {
        case 'ft':   return roundArea(value);
        case 'inch': return roundArea(value / 12);
        case 'mm':   return roundArea(value / 304.8);
        default:     throw new Error(`toFeet: unknown system "${system}"`);
    }
}

// ──────────────────────────────────────────────
// Area Calculations
// ──────────────────────────────────────────────

/**
 * Calculate the area of a single panel row (length × width × qty).
 * @param {{ length_ft: number, width_ft: number, qty: number }} panel
 * @returns {number} area in sqft (2 decimals)
 */
function panelArea(panel) {
    return roundArea(panel.length_ft * panel.width_ft * panel.qty);
}

/**
 * Sum of all panel areas for a unit.
 * @param {Array<{ length_ft: number, width_ft: number, qty: number }>} panels
 * @returns {number} total carcass area in sqft (2 decimals)
 */
function carcassArea(panels) {
    const total = panels.reduce((sum, p) => sum + panelArea(p), 0);
    return roundArea(total);
}

/**
 * Carcass area plus wastage.
 * @param {number} carcass - carcass area in sqft
 * @param {number} wastagePct - wastage percentage (e.g. 10 for 10%)
 * @returns {number} usable area in sqft (2 decimals)
 */
function usableArea(carcass, wastagePct) {
    return roundArea(carcass * (1 + wastagePct / 100));
}

// ──────────────────────────────────────────────
// Cost Calculations
// ──────────────────────────────────────────────

/**
 * Material cost = usable area × finish rate per sqft.
 * @param {number} usable - usable area in sqft
 * @param {number} finishRate - rate per sqft in ₹
 * @returns {number} cost in whole ₹
 */
function materialCost(usable, finishRate) {
    return roundMoney(usable * finishRate);
}

/**
 * Sum of hardware line items (qty × rate).
 * @param {Array<{ qty: number, rate: number }>} lines
 * @returns {number} cost in whole ₹
 */
function hardwareCost(lines) {
    const total = lines.reduce((sum, l) => sum + l.qty * l.rate, 0);
    return roundMoney(total);
}

/**
 * Sum of accessory line items (qty × rate).
 * @param {Array<{ qty: number, rate: number }>} lines
 * @returns {number} cost in whole ₹
 */
function accessoryCost(lines) {
    const total = lines.reduce((sum, l) => sum + l.qty * l.rate, 0);
    return roundMoney(total);
}

/**
 * Labour cost — either usable area × per-sqft rate, or a lump sum.
 * If lumpSum is provided and > 0, it takes precedence.
 * @param {number} usable - usable area in sqft
 * @param {number} labourRate - per-sqft rate in ₹
 * @param {number|null} [lumpSum] - optional fixed lump sum in ₹
 * @returns {number} cost in whole ₹
 */
function labourCost(usable, labourRate, lumpSum) {
    if (lumpSum != null && lumpSum > 0) {
        return roundMoney(lumpSum);
    }
    return roundMoney(usable * labourRate);
}

/**
 * Unit subtotal = material + hardware + accessory + labour + transport.
 * @param {number} material
 * @param {number} hardware
 * @param {number} accessory
 * @param {number} labour
 * @param {number} transport
 * @returns {number} subtotal in whole ₹
 */
function unitSubtotal(material, hardware, accessory, labour, transport) {
    return roundMoney(material + hardware + accessory + labour + transport);
}

/**
 * Project subtotal = sum of all unit subtotals.
 * @param {number[]} unitSubtotals
 * @returns {number} project subtotal in whole ₹
 */
function projectSubtotal(unitSubtotals) {
    const total = unitSubtotals.reduce((sum, s) => sum + s, 0);
    return roundMoney(total);
}

/**
 * Margin amount.
 * @param {number} projSubtotal
 * @param {number} marginPct - e.g. 15 for 15%
 * @returns {number} margin in whole ₹
 */
function margin(projSubtotal, marginPct) {
    return roundMoney(projSubtotal * marginPct / 100);
}

/**
 * GST amount = (projectSubtotal + margin) × gstPct / 100.
 * @param {number} projSubtotal
 * @param {number} marginAmount
 * @param {number} gstPct - e.g. 18 for 18%
 * @returns {number} GST in whole ₹
 */
function gst(projSubtotal, marginAmount, gstPct) {
    return roundMoney((projSubtotal + marginAmount) * gstPct / 100);
}

/**
 * Grand total = projectSubtotal + margin + GST.
 * @param {number} projSubtotal
 * @param {number} marginAmount
 * @param {number} gstAmount
 * @returns {number} grand total in whole ₹
 */
function grandTotal(projSubtotal, marginAmount, gstAmount) {
    return roundMoney(projSubtotal + marginAmount + gstAmount);
}

// ──────────────────────────────────────────────
// High-level: compute full breakdown for a unit
// ──────────────────────────────────────────────

/**
 * Compute a full cost breakdown for one unit.
 * @param {object} unit - { finish, wastage_pct, labour_rate, labour_lump_sum, transport }
 * @param {Array} panels - [{ length_ft, width_ft, qty }]
 * @param {Array} hardwareLines - [{ qty, rate }]
 * @param {Array} accessoryLines - [{ qty, rate }]
 * @param {number} finishRate - rate per sqft for unit's finish
 * @returns {object} breakdown
 */
function computeUnitBreakdown(unit, panels, hardwareLines, accessoryLines, finishRate) {
    const carcass = carcassArea(panels);
    const usable = usableArea(carcass, unit.wastage_pct);
    const matCost = materialCost(usable, finishRate);
    const hwCost = hardwareCost(hardwareLines);
    const accCost = accessoryCost(accessoryLines);
    const labCost = labourCost(usable, unit.labour_rate, unit.labour_lump_sum);
    const subtotal = unitSubtotal(matCost, hwCost, accCost, labCost, unit.transport);

    return {
        carcass_area: carcass,
        usable_area: usable,
        material_cost: matCost,
        hardware_cost: hwCost,
        accessory_cost: accCost,
        labour_cost: labCost,
        transport: unit.transport,
        subtotal,
    };
}

/**
 * Compute a full project-level quote breakdown.
 * @param {Array<object>} unitBreakdowns - array from computeUnitBreakdown
 * @param {number} marginPct
 * @param {number} gstPct
 * @returns {object} project totals
 */
function computeProjectTotals(unitBreakdowns, marginPct, gstPct) {
    const subtotals = unitBreakdowns.map(u => u.subtotal);
    const projSub = projectSubtotal(subtotals);
    const marginAmt = margin(projSub, marginPct);
    const gstAmt = gst(projSub, marginAmt, gstPct);
    const total = grandTotal(projSub, marginAmt, gstAmt);

    return {
        project_subtotal: projSub,
        margin_pct: marginPct,
        margin_amount: marginAmt,
        gst_pct: gstPct,
        gst_amount: gstAmt,
        grand_total: total,
    };
}

// ──────────────────────────────────────────────
// Rounding helpers
// ──────────────────────────────────────────────

/** Round to whole rupees. */
function roundMoney(val) {
    return Math.round(val);
}

/** Round area to 2 decimal places. */
function roundArea(val) {
    return parseFloat(val.toFixed(2));
}

module.exports = {
    toFeet,
    panelArea,
    carcassArea,
    usableArea,
    materialCost,
    hardwareCost,
    accessoryCost,
    labourCost,
    unitSubtotal,
    projectSubtotal,
    margin,
    gst,
    grandTotal,
    computeUnitBreakdown,
    computeProjectTotals,
    roundMoney,
    roundArea,
};
