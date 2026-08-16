/* ============================================================
   UNICOMMERCE EPL + VELOCITY PREVIEWER
   ============================================================

   IMPORTANT:

   JSON ORDER DOES NOT MATTER
   JSON CAPITALIZATION DOES NOT MATTER

   UniCommerce mapping:

   ?
   $row.getColumnValue('ProductCode')
   $row.getColumnValue('MRP')

   automatically means:

   V00 -> ProductCode
   V01 -> MRP

   Example:

   ?
   $row.getColumnValue('Brand')
   $row.getColumnValue('SKU')
   $row.getColumnValue('Color')
   $row.getColumnValue('Size')

   means:

   V00 -> Brand
   V01 -> SKU
   V02 -> Color
   V03 -> Size

   ============================================================ */

/* ============================================================
   STATE
   ============================================================ */

const state = {
  zoom: 1,

  dpi: 203,

  layers: 2,

  gapDots: 4,

  labelWidthDots: 406,

  labelHeightDots: 203,

  totalWidthDots: 812,

  totalHeightDots: 203,

  objects: [],

  errors: [],

  warnings: [],

  rows: [],

  mappings: [],

  variables: {},
};

/* ============================================================
   DOM
   ============================================================ */

const $ = (id) => document.getElementById(id);

const eplCode = $("eplCode");
const dataJson = $("dataJson");

const labelWidth = $("labelWidth");
const labelHeight = $("labelHeight");
const dpi = $("dpi");
const layers = $("layers");
const gap = $("gap");

const previewViewport = $("previewViewport");
const previewCanvas = $("previewCanvas");
const previewPaper = $("previewPaper");

const previewInfo = $("previewInfo");
const physicalInfo = $("physicalInfo");
const dotInfo = $("dotInfo");
const layerInfo = $("layerInfo");
const objectInfo = $("objectInfo");
const statusInfo = $("statusInfo");
const zoomValue = $("zoomValue");

const jsonStatus = $("jsonStatus");

const validationSummary = $("validationSummary");
const validationMessages = $("validationMessages");

/* ============================================================
   SAFE VALUE
   ============================================================ */

function valueToString(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/* ============================================================
   NORMALIZE FIELD NAME
   ============================================================

   Makes these equivalent:

   SKU
   sku
   Sku
   sKu

   Also handles:

   ProductCode
   product_code
   product-code
   PRODUCTCODE

   ============================================================ */

function normalizeFieldName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

/* ============================================================
   GET JSON VALUE - CASE INSENSITIVE
   ============================================================ */

function getDataValue(data, field) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "";
  }

  const wanted = normalizeFieldName(field);

  const actualKey = Object.keys(data).find(
    (key) => normalizeFieldName(key) === wanted,
  );

  if (!actualKey) {
    return "";
  }

  return valueToString(data[actualKey]);
}

/* ============================================================
   PARSE JSON
   ============================================================ */

function parseJsonData() {
  try {
    const raw = String(dataJson?.value || "").trim();

    if (!raw) {
      throw new Error("JSON is empty.");
    }

    const parsed = JSON.parse(raw);

    if (jsonStatus) {
      jsonStatus.textContent = "✓ JSON is valid";

      jsonStatus.className = "json-status ok";
    }

    return parsed;
  } catch (error) {
    if (jsonStatus) {
      jsonStatus.textContent = `✗ ${error.message}`;

      jsonStatus.className = "json-status error";
    }

    state.errors.push(`JSON error: ${error.message}`);

    return {};
  }
}

/* ============================================================
   GET ROWS
   ============================================================

   Supports:

   1.

   {
     "SKU":"ABC",
     "MRP":"299"
   }

   2.

   [
     {
       "SKU":"ABC"
     },
     {
       "SKU":"XYZ"
     }
   ]

   3.

   {
     "rows":[
       {
         "SKU":"ABC"
       }
     ]
   }

   ============================================================ */

function getRows(data) {
  if (Array.isArray(data)) {
    return data.filter(
      (row) => row && typeof row === "object" && !Array.isArray(row),
    );
  }

  if (data && typeof data === "object" && Array.isArray(data.rows)) {
    return data.rows.filter(
      (row) => row && typeof row === "object" && !Array.isArray(row),
    );
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return [data];
  }

  return [];
}

/* ============================================================
   DIMENSIONS
   ============================================================ */

function inchToDots(value, dpiValue) {
  return Math.round(Number(value) * Number(dpiValue));
}

function calculateDimensions(rowCount) {
  const widthInch = Math.max(0.1, parseFloat(labelWidth?.value) || 2);

  const heightInch = Math.max(0.1, parseFloat(labelHeight?.value) || 1);

  const dpiValue = parseInt(dpi?.value, 10) || 203;

  const layerCount = Math.max(1, parseInt(layers?.value, 10) || 1);

  const gapInch = Math.max(0, parseFloat(gap?.value) || 0);

  state.dpi = dpiValue;

  state.layers = layerCount;

  state.labelWidthDots = inchToDots(widthInch, dpiValue);

  state.labelHeightDots = inchToDots(heightInch, dpiValue);

  state.gapDots = inchToDots(gapInch, dpiValue);

  /*
     IMPORTANT:

     Layers are horizontal.

     Rows are vertical.
  */

  state.totalWidthDots =
    state.labelWidthDots * state.layers +
    state.gapDots * Math.max(0, state.layers - 1);

  state.totalHeightDots = state.labelHeightDots * Math.max(1, rowCount);

  if (previewInfo) {
    previewInfo.textContent =
      `${widthInch} × ${heightInch} inch | ` +
      `${state.layers} layer` +
      (state.layers > 1 ? "s" : "") +
      ` | ${rowCount} row` +
      (rowCount !== 1 ? "s" : "");
  }

  if (physicalInfo) {
    physicalInfo.textContent = `${widthInch} × ${heightInch} inch`;
  }

  if (dotInfo) {
    dotInfo.textContent =
      `${state.totalWidthDots} × ` +
      `${state.totalHeightDots} dots @ ` +
      `${dpiValue} DPI`;
  }

  if (layerInfo) {
    layerInfo.textContent = state.layers;
  }
}

/* ============================================================
   FIND EPL VARIABLES
   ============================================================

   Finds:

   V00
   V01
   V02
   ...

   from:

   V00,50,N,""
   V01,50,N,""

   ============================================================ */

function extractVariables(code) {
  const found = [];

  const regex = /^\s*V(\d+)\s*,/gim;

  let match;

  while ((match = regex.exec(code)) !== null) {
    const variable = "V" + String(match[1]).padStart(2, "0");

    if (!found.includes(variable)) {
      found.push(variable);
    }
  }

  found.sort(
    (a, b) => parseInt(a.substring(1), 10) - parseInt(b.substring(1), 10),
  );

  return found;
}

/* ============================================================
   FIND FOREACH BLOCK
   ============================================================ */

function getForeachBlock(code) {
  const match = String(code).match(
    /#foreach\s*\(\s*\$row\s+in\s+\$rows\s*\)([\s\S]*?)#end/i,
  );

  if (!match) {
    return {
      exists: false,
      body: "",
    };
  }

  return {
    exists: true,
    body: match[1],
  };
}

/* ============================================================
   EXTRACT VELOCITY MAPPING
   ============================================================

   THIS IS THE MAIN FIX.

   Example:

   #foreach($row in $rows)
   FR"1"
   ?
   $row.getColumnValue('ProductCode')
   $row.getColumnValue('MRP')
   #end

   becomes:

   V00 -> ProductCode
   V01 -> MRP

   ============================================================ */

function extractVelocityMapping(code) {
  const variables = extractVariables(code);

  const mappings = [];

  const foreachInfo = getForeachBlock(code);

  if (!foreachInfo.exists) {
    return {
      variables,
      mappings,
    };
  }

  const body = foreachInfo.body;

  /*
     Find ?

     The question mark is the beginning
     of the UniCommerce variable data section.
  */

  const questionMatch = body.match(/^\s*\?\s*$/im);

  if (!questionMatch) {
    return {
      variables,
      mappings,
    };
  }

  const questionPosition = questionMatch.index;

  const afterQuestion = body.substring(
    questionPosition + questionMatch[0].length,
  );

  /*
     Read every Velocity expression
     after ?
  */

  const velocityFields = [];

  const regex = /\$row\.getColumnValue\(\s*['"]([^'"]+)['"]\s*\)/gi;

  let match;

  while ((match = regex.exec(afterQuestion)) !== null) {
    velocityFields.push(match[1].trim());
  }

  /*
     POSITIONAL MAPPING

     First field -> V00
     Second field -> V01
     Third field -> V02

     etc.
  */

  velocityFields.forEach((field, index) => {
    if (!variables[index]) {
      state.warnings.push(`Velocity field "${field}" has no EPL variable.`);

      return;
    }

    mappings.push({
      variable: variables[index],

      field,

      index,
    });
  });

  return {
    variables,
    mappings,
  };
}

/* ============================================================
   BUILD VARIABLES FOR CURRENT ROW
   ============================================================ */

function buildVariables(row, mappings, variables) {
  const result = {};

  /*
     Initialize.
  */

  variables.forEach((variable) => {
    result[variable] = "";
  });

  /*
     Apply Velocity mapping.
  */

  mappings.forEach((mapping) => {
    result[mapping.variable] = getDataValue(row, mapping.field);
  });

  /*
     Direct V00 JSON fallback.

     Example:

     {
       "v00":"ABC"
     }

     works too.
  */

  variables.forEach((variable) => {
    if (result[variable] !== "") {
      return;
    }

    const direct = getDataValue(row, variable);

    if (direct !== "") {
      result[variable] = direct;
    }
  });

  return result;
}

/* ============================================================
   VELOCITY REPLACEMENT
   ============================================================ */

function replaceVelocity(text, row) {
  let result = String(text || "");

  /*
     $row.getColumnValue('SKU')
  */

  result = result.replace(
    /\$row\.getColumnValue\(\s*['"]([^'"]+)['"]\s*\)/gi,

    (complete, field) => {
      return getDataValue(row, field);
    },
  );

  /*
     {{SKU}}
  */

  result = result.replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,

    (complete, field) => {
      return getDataValue(row, field.trim());
    },
  );

  /*
     ${SKU}
  */

  result = result.replace(
    /\$\{\s*([^{}]+?)\s*\}/g,

    (complete, field) => {
      return getDataValue(row, field.trim());
    },
  );

  return result;
}

/* ============================================================
   EPL VARIABLE REPLACEMENT
   ============================================================ */

function replaceVariables(text, variables) {
  return String(text || "").replace(
    /\bV\d{2}\b/g,

    (variable) => {
      if (Object.prototype.hasOwnProperty.call(variables, variable)) {
        return variables[variable];
      }

      return "";
    },
  );
}

/* ============================================================
   CLEAN EPL TEXT
   ============================================================ */

function cleanText(raw, variables, row) {
  let text = String(raw || "");

  /*
     Velocity first.
  */

  text = replaceVelocity(text, row);

  /*
     EPL variables second.
  */

  text = replaceVariables(text, variables);

  /*
     Remove EPL quotes.

     "SKU:"V00

     becomes:

     SKU:ABHASH
  */

  text = text.replace(/"/g, "");

  return text;
}

/* ============================================================
   SPLIT EPL
   ============================================================ */

function splitEpl(text) {
  const result = [];

  let current = "";

  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      quoted = !quoted;

      current += char;

      continue;
    }

    if (char === "," && !quoted) {
      result.push(current.trim());

      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  return result;
}

/* ============================================================
   PARSE A TEXT COMMAND
   ============================================================ */

function parseTextCommand(line, variables, row) {
  if (!/^A\s*-?\d+/i.test(line)) {
    return null;
  }

  const body = line.substring(1).trim();

  const firstComma = body.indexOf(",");

  if (firstComma === -1) {
    return null;
  }

  const x = parseInt(body.substring(0, firstComma), 10);

  if (Number.isNaN(x)) {
    return null;
  }

  const remaining = body.substring(firstComma + 1);

  const parts = splitEpl(remaining);

  if (parts.length < 7) {
    return null;
  }

  const y = parseInt(parts[0], 10) || 0;

  const rotation = parseInt(parts[1], 10) || 0;

  const font = parts[2] || "1";

  const horizontal = Math.max(1, parseInt(parts[3], 10) || 1);

  const vertical = Math.max(1, parseInt(parts[4], 10) || 1);

  const reverse = String(parts[5] || "N")
    .replace(/"/g, "")
    .toUpperCase();

  const rawData = parts.slice(6).join(",");

  const text = cleanText(rawData, variables, row);

  return {
    type: "text",

    x,

    y,

    rotation: ((rotation % 4) + 4) % 4,

    font,

    horizontal,

    vertical,

    reverse,

    text,
  };
}

/* ============================================================
   PARSE B BARCODE COMMAND
   ============================================================ */

function parseBarcodeCommand(line, variables, row) {
  if (!/^B\s*-?\d+/i.test(line)) {
    return null;
  }

  const body = line.substring(1).trim();

  const parts = splitEpl(body);

  if (parts.length < 9) {
    return null;
  }

  const x = parseInt(parts[0], 10) || 0;

  const y = parseInt(parts[1], 10) || 0;

  const rotation = (((parseInt(parts[2], 10) || 0) % 4) + 4) % 4;

  const barcodeType = String(parts[3] || "1")
    .replace(/"/g, "")
    .toUpperCase();

  const narrowBar = Math.max(1, parseInt(parts[4], 10) || 1);

  const wideBar = Math.max(
    narrowBar + 1,
    parseInt(parts[5], 10) || narrowBar * 2,
  );

  const height = Math.max(10, parseInt(parts[6], 10) || 40);

  const humanReadable = String(parts[7] || "N")
    .replace(/"/g, "")
    .toUpperCase();

  let barcodeData = parts.slice(8).join(",");

  /*
     Velocity first.
  */

  barcodeData = replaceVelocity(barcodeData, row);

  /*
     EPL V variables second.
  */

  barcodeData = replaceVariables(barcodeData, variables);

  barcodeData = barcodeData.replace(/"/g, "");

  return {
    type: "barcode",

    x,

    y,

    rotation,

    barcodeType,

    narrowBar,

    wideBar,

    height,

    humanReadable,

    data: barcodeData,
  };
}

/* ============================================================
   IMPORTANT:
   GET EPL COMMANDS ONLY
   ============================================================

   THIS FIXES YOUR BLANK PREVIEW.

   Your template is:

   EPL COMMANDS
   ...
   PA1,1
   FE

   #foreach(...)
   FR"1"
   ?
   Velocity mappings
   #end

   We MUST NOT take the foreach body as EPL.

   We only REMOVE:

   #foreach...
   #end

   and remove the mapping-only lines.

   The A/B commands outside foreach remain.
   ============================================================ */

function getRenderableEpl(code) {
  let result = String(code || "");

  /*
     Remove entire foreach block.

     IMPORTANT:

     We do NOT replace it with the body.

     We remove it completely.

     Because your actual A/B EPL is OUTSIDE
     the foreach block.
  */

  result = result.replace(
    /#foreach\s*\(\s*\$row\s+in\s+\$rows\s*\)[\s\S]*?#end/gi,
    "",
  );

  /*
     Remove standalone Velocity mapping
     expressions if they somehow exist
     outside the loop.
  */

  result = result.replace(/^\s*\$row\.getColumnValue\([^)]*\)\s*$/gim, "");

  /*
     Remove ?
     */

  result = result.replace(/^\s*\?\s*$/gim, "");

  /*
     Remove FR.
  */

  result = result.replace(/^\s*FR.*$/gim, "");

  return result;
}

/* ============================================================
   PARSE EPL
   ============================================================ */

function parseEpl(code, variables, row) {
  const objects = [];

  const lines = code.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      return;
    }

    /*
         Comments
      */

    if (line.startsWith(";")) {
      return;
    }

    /*
         Control commands
      */

    if (
      /^FK/i.test(line) ||
      /^FS/i.test(line) ||
      /^V\d+/i.test(line) ||
      /^PA/i.test(line) ||
      /^FE/i.test(line) ||
      /^FR/i.test(line) ||
      /^\?/i.test(line) ||
      /^#foreach/i.test(line) ||
      /^#end/i.test(line)
    ) {
      return;
    }

    /*
         A TEXT
      */

    if (/^A\s*-?\d+/i.test(line)) {
      const object = parseTextCommand(line, variables, row);

      if (object) {
        object.line = index + 1;

        objects.push(object);
      }

      return;
    }

    /*
         B BARCODE
      */

    if (/^B\s*-?\d+/i.test(line)) {
      const object = parseBarcodeCommand(line, variables, row);

      if (object) {
        object.line = index + 1;

        objects.push(object);
      }

      return;
    }
  });

  return objects;
}

/* ============================================================
   FONT SIZE
   ============================================================ */

function getFontSize(font) {
  const sizes = {
    1: 12,

    2: 16,

    3: 20,

    4: 24,

    5: 32,
  };

  return sizes[String(font)] || 12;
}

/* ============================================================
   LAYER X
   ============================================================ */

function getLabelStartX(layerIndex) {
  return layerIndex * (state.labelWidthDots + state.gapDots);
}

/* ============================================================
   ROW Y
   ============================================================ */

function getLabelStartY(rowIndex) {
  return rowIndex * state.labelHeightDots;
}

/* ============================================================
   GET LAYER
   ============================================================ */

function getLayerForX(x) {
  const slotWidth = state.labelWidthDots + state.gapDots;

  if (slotWidth <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(state.layers - 1, Math.floor(x / slotWidth)));
}

/* ============================================================
   LOCAL X
   ============================================================ */

function getLocalX(x, layerIndex) {
  return x - getLabelStartX(layerIndex);
}

/* ============================================================
   TEXT BOUNDS
   ============================================================ */

function getTextBounds(object) {
  const fontSize = getFontSize(object.font);

  const width = Math.max(
    1,
    object.text.length * fontSize * 0.6 * object.horizontal,
  );

  const height = fontSize * object.vertical;

  if (object.rotation === 1 || object.rotation === 3) {
    return {
      width: height,

      height: width,
    };
  }

  return {
    width,

    height,
  };
}

/* ============================================================
   BARCODE BOUNDS
   ============================================================ */

function getBarcodeBounds(object) {
  const length = Math.max(1, object.data.length);

  const width = Math.max(30, length * object.narrowBar * 9);

  const height = object.height;

  if (object.rotation === 1 || object.rotation === 3) {
    return {
      width: height,

      height: width,
    };
  }

  return {
    width,

    height,
  };
}

/* ============================================================
   CREATE LABELS
   ============================================================ */

function createLabels(rowCount) {
  const labels = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    for (let layerIndex = 0; layerIndex < state.layers; layerIndex++) {
      const label = document.createElement("div");

      label.className = "epl-label";

      label.style.position = "absolute";

      label.style.left = `${getLabelStartX(layerIndex)}px`;

      label.style.top = `${getLabelStartY(rowIndex)}px`;

      label.style.width = `${state.labelWidthDots}px`;

      label.style.height = `${state.labelHeightDots}px`;

      label.style.boxSizing = "border-box";

      /*
         Grid
      */

      const grid = document.createElement("div");

      grid.className = "coordinate-grid";

      label.appendChild(grid);

      /*
         Title
      */

      const title = document.createElement("div");

      title.className = "layer-title";

      title.textContent = `Row ${rowIndex + 1} / Layer ${layerIndex + 1}`;

      label.appendChild(title);

      previewPaper.appendChild(label);

      labels.push({
        rowIndex,

        layerIndex,

        element: label,
      });
    }
  }

  return labels;
}

/* ============================================================
   CREATE TEXT
   ============================================================ */

function createTextElement(object) {
  const element = document.createElement("div");

  element.className = "epl-text";

  element.textContent = object.text;

  element.style.position = "absolute";

  element.style.left = `${object.localX}px`;

  element.style.top = `${object.y}px`;

  element.style.fontSize = `${getFontSize(object.font)}px`;

  element.style.fontWeight = "bold";

  element.style.color = "#000000";

  element.style.background = "transparent";

  element.style.visibility = "visible";

  element.style.display = "block";

  element.style.opacity = "1";

  element.style.whiteSpace = "pre";

  element.style.width = "max-content";

  element.style.height = "auto";

  element.style.zIndex = "100";

  element.style.transform = `scale(
      ${object.horizontal},
      ${object.vertical}
    )
    rotate(
      ${object.rotation * 90}deg
    )`;

  if (object.reverse === "R") {
    element.style.color = "#ffffff";

    element.style.background = "#000000";
  }

  return element;
}

/* ============================================================
   BARCODE FORMAT
   ============================================================ */

function getBarcodeFormat(type) {
  const map = {
    1: "CODE39",

    2: "CODE128",

    3: "CODE128",

    9: "CODE93",

    E30: "EAN13",

    E80: "EAN8",

    UA0: "UPC",
  };

  return map[String(type).toUpperCase()] || "CODE128";
}

/* ============================================================
   CREATE BARCODE
   ============================================================ */

function createBarcodeElement(object) {
  const wrapper = document.createElement("div");

  wrapper.className = "epl-barcode";

  wrapper.style.position = "absolute";

  wrapper.style.left = `${object.localX}px`;

  wrapper.style.top = `${object.y}px`;

  wrapper.style.zIndex = "20";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  wrapper.appendChild(svg);

  const data = object.data || "000000";

  const format = getBarcodeFormat(object.barcodeType);

  /*
     Check JsBarcode
  */

  if (typeof JsBarcode !== "function") {
    wrapper.textContent = data;

    wrapper.style.fontWeight = "bold";

    return wrapper;
  }

  try {
    JsBarcode(svg, data, {
      format,

      width: Math.max(1, object.narrowBar),

      height: object.height,

      displayValue: object.humanReadable === "Y",

      margin: 0,

      fontSize: 10,

      textMargin: 2,
    });
  } catch (error) {
    console.warn("Barcode error:", error);

    try {
      JsBarcode(svg, data, {
        format: "CODE128",

        width: Math.max(1, object.narrowBar),

        height: object.height,

        displayValue: object.humanReadable === "Y",

        margin: 0,
      });
    } catch (error2) {
      wrapper.textContent = data;
    }
  }

  wrapper.style.transform = `rotate(
      ${object.rotation * 90}deg
    )`;

  return wrapper;
}

/* ============================================================
   VALIDATE
   ============================================================ */

function validateObject(object, bounds, rowIndex) {
  if (object.localX < 0) {
    state.errors.push(
      `Row ${rowIndex + 1}, line ${object.line}: X is outside label.`,
    );
  }

  if (object.localX + bounds.width > state.labelWidthDots) {
    state.errors.push(
      `Row ${rowIndex + 1}, line ${object.line}: object exceeds label width.`,
    );
  }

  if (object.y < 0) {
    state.errors.push(`Row ${rowIndex + 1}, line ${object.line}: negative Y.`);
  }

  if (object.y + bounds.height > state.labelHeightDots) {
    state.errors.push(
      `Row ${rowIndex + 1}, line ${object.line}: object exceeds label height.`,
    );
  }
}

/* ============================================================
   OVERLAP
   ============================================================ */

function detectOverlaps(objects) {
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];

      const b = objects[j];

      if (a.rowIndex !== b.rowIndex) {
        continue;
      }

      if (a.layer !== b.layer) {
        continue;
      }

      const overlap =
        a.localX < b.localX + b.bounds.width &&
        a.localX + a.bounds.width > b.localX &&
        a.y < b.y + b.bounds.height &&
        a.y + a.bounds.height > b.y;

      if (overlap) {
        state.warnings.push(
          `Possible overlap: row ${a.rowIndex + 1}, line ${a.line} and line ${b.line}.`,
        );
      }
    }
  }
}

/* ============================================================
   VALIDATION MESSAGE
   ============================================================ */

function addValidationMessage(message, type) {
  if (!validationMessages) {
    return;
  }

  const element = document.createElement("div");

  element.className = `validation-message ${type}`;

  element.textContent = message;

  validationMessages.appendChild(element);
}

/* ============================================================
   SHOW VALIDATION
   ============================================================ */

function showValidation() {
  if (validationMessages) {
    validationMessages.innerHTML = "";
  }

  /*
     Show mapping.
  */

  if (state.mappings.length) {
    state.mappings.forEach((mapping) => {
      addValidationMessage(`${mapping.variable} → ${mapping.field}`, "success");
    });
  }

  /*
     Errors.
  */

  if (state.errors.length) {
    if (validationSummary) {
      validationSummary.textContent = `${state.errors.length} error(s)`;
    }

    if (statusInfo) {
      statusInfo.textContent = "Errors";

      statusInfo.className = "status-error";
    }

    state.errors.forEach((error) => {
      addValidationMessage(error, "error");
    });

    return;
  }

  /*
     Warnings.
  */

  state.warnings.forEach((warning) => {
    addValidationMessage(warning, "warning");
  });

  if (validationSummary) {
    validationSummary.textContent = state.warnings.length
      ? `${state.warnings.length} warning(s)`
      : "Valid";
  }

  if (statusInfo) {
    statusInfo.textContent = state.warnings.length ? "Warnings" : "Valid";

    statusInfo.className = state.warnings.length
      ? "status-warning"
      : "status-ready";
  }

  addValidationMessage(
    `✓ ${state.objects.length} visual object(s) detected.`,
    "success",
  );
}

/* ============================================================
   RENDER PREVIEW
   ============================================================ */

function renderPreview() {
  /*
     RESET
  */

  state.objects = [];

  state.errors = [];

  state.warnings = [];

  state.rows = [];

  state.mappings = [];

  state.variables = {};

  /*
     JSON
  */

  const data = parseJsonData();

  const rows = getRows(data);

  state.rows = rows;

  if (!rows.length) {
    state.errors.push("No JSON row found.");

    calculateDimensions(1);

    if (previewPaper) {
      previewPaper.innerHTML = "";
    }

    showValidation();

    return;
  }

  /*
     EPL
  */

  const code = String(eplCode?.value || "");

  if (!code.trim()) {
    state.errors.push("EPL code is empty.");

    calculateDimensions(rows.length);

    if (previewPaper) {
      previewPaper.innerHTML = "";
    }

    showValidation();

    return;
  }

  /*
     =========================================
     STEP 1
     Read V00, V01, V02...
     =========================================
  */

  const variables = extractVariables(code);

  /*
     =========================================
     STEP 2
     Read UniCommerce Velocity mapping
     =========================================

     Example:

     ?
     $row.getColumnValue('ProductCode')
     $row.getColumnValue('MRP')

     V00 -> ProductCode
     V01 -> MRP
  */

  const mappingInfo = extractVelocityMapping(code);

  state.mappings = mappingInfo.mappings;

  /*
     =========================================
     STEP 3
     IMPORTANT FIX
     =========================================

     Keep the EPL A/B commands.

     Remove ONLY the foreach/mapping block.

     This fixes the blank preview.
  */

  const renderableEpl = getRenderableEpl(code);

  /*
     =========================================
     STEP 4
     Determine number of rows
     =========================================

     If #foreach exists:
        render ALL rows.

     If no #foreach:
        render only first row.
  */

  const foreachInfo = getForeachBlock(code);

  const renderRows = foreachInfo.exists ? rows : [rows[0]];

  /*
     =========================================
     STEP 5
     PAPER
     =========================================
  */

  calculateDimensions(renderRows.length);

  /*
     =========================================
     STEP 6
     CLEAR PAPER
     =========================================
  */

  if (previewPaper) {
    previewPaper.innerHTML = "";

    previewPaper.style.position = "relative";

    previewPaper.style.width = `${state.totalWidthDots}px`;

    previewPaper.style.height = `${state.totalHeightDots}px`;

    previewPaper.style.minHeight = `${state.totalHeightDots}px`;
  }

  /*
     =========================================
     STEP 7
     CREATE LABELS
     =========================================
  */

  const labels = createLabels(renderRows.length);

  /*
     =========================================
     STEP 8
     COMPILE EACH JSON ROW
     =========================================
  */

  renderRows.forEach((row, rowIndex) => {
    /*
         Build V variables from Velocity ? mapping.
      */

    const rowVariables = buildVariables(row, mappingInfo.mappings, variables);

    state.variables = rowVariables;

    /*
         Parse A/B commands.
      */

    const objects = parseEpl(renderableEpl, rowVariables, row);

    /*
         Render.
      */

    objects.forEach((object) => {
      /*
             X determines layer.
          */

      const layer = getLayerForX(object.x);

      object.layer = layer;

      object.rowIndex = rowIndex;

      /*
             X inside layer.
          */

      object.localX = getLocalX(object.x, layer);

      /*
             Find label.
          */

      const labelInfo = labels.find(
        (item) => item.rowIndex === rowIndex && item.layerIndex === layer,
      );

      if (!labelInfo) {
        state.errors.push(
          `Could not find label for row ${rowIndex + 1}, layer ${layer + 1}.`,
        );

        return;
      }

      const label = labelInfo.element;

      let element;

      let bounds;

      /*
             TEXT
          */

      if (object.type === "text") {
        bounds = getTextBounds(object);

        element = createTextElement(object);
      } else {
        /*
             BARCODE
          */
        bounds = getBarcodeBounds(object);

        element = createBarcodeElement(object);
      }

      object.bounds = bounds;

      /*
             Validation.
          */

      validateObject(object, bounds, rowIndex);

      /*
             Boundary.
          */

      const boundary = document.createElement("div");

      boundary.className = "object-boundary";

      boundary.style.position = "absolute";

      boundary.style.left = `${object.localX}px`;

      boundary.style.top = `${object.y}px`;

      boundary.style.width = `${Math.max(1, bounds.width)}px`;

      boundary.style.height = `${Math.max(1, bounds.height)}px`;

      boundary.style.pointerEvents = "none";

      label.appendChild(boundary);

      /*
             Actual object.
          */

      label.appendChild(element);

      state.objects.push(object);
    });
  });

  /*
     Overlaps.
  */

  detectOverlaps(state.objects);

  /*
     Object count.
  */

  if (objectInfo) {
    objectInfo.textContent = state.objects.length;
  }

  /*
     Validation.
  */

  showValidation();

  /*
     Fit.
  */

  fitPreview();
}

/* ============================================================
   ZOOM
   ============================================================ */

function applyZoom() {
  if (!previewPaper) {
    return;
  }

  previewPaper.style.transform = `scale(${state.zoom})`;

  previewPaper.style.transformOrigin = "top left";

  if (zoomValue) {
    zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  if (previewCanvas && previewViewport) {
    const width = state.totalWidthDots * state.zoom;

    const height = state.totalHeightDots * state.zoom;

    previewCanvas.style.width = `${Math.max(
      width + 100,
      previewViewport.clientWidth,
    )}px`;

    previewCanvas.style.height = `${Math.max(
      height + 100,
      previewViewport.clientHeight,
    )}px`;
  }
}

/* ============================================================
   FIT
   ============================================================ */

function fitPreview() {
  if (!previewViewport || !previewPaper) {
    return;
  }

  if (previewViewport.clientWidth <= 0) {
    return;
  }

  previewPaper.style.transform = "none";

  const availableWidth = Math.max(100, previewViewport.clientWidth - 100);

  const availableHeight = Math.max(100, previewViewport.clientHeight - 100);

  let newZoom = Math.min(
    availableWidth / Math.max(1, state.totalWidthDots),

    availableHeight / Math.max(1, state.totalHeightDots),
  );

  newZoom = Math.max(0.25, Math.min(newZoom, 2));

  state.zoom = newZoom;

  applyZoom();
}

/* ============================================================
   SAMPLE DATA
   ============================================================ */

const SAMPLE_DATA = {
  MRP: "999.00",
  Brand: "Ethansports",
  Color: "BLUE",
  Size: "M",
  SKU: "ETH-CAP-ESLC-BLUE",
};

/* ============================================================
   SAMPLE EPL
   ============================================================ */

const SAMPLE_EPL = `FK"1"
FS"1"

V00,50,N,"" sku
V01,50,N,""  mrp
V02,50,N,""  size
V03,50,N,""  color
V04,50,N,""  brand

A110,10,0,1,2,2,N,V04
A20,50,0,1,1,1,N,"SKU : "V00
A20,70,0,1,1,1,N,"SIZE : "V02
A20,90,0,1,1,1,N,"MRP : "V01
A20,110,0,1,1,1,N,"COLOR : "V03
B20,135,0,1,1,1,40,Y,V00

PA1,1
FE

#foreach($row in $rows)
FR"1"
?
$row.getColumnValue('SKU')
$row.getColumnValue('MRP')
$row.getColumnValue('SIZE')
$row.getColumnValue('COLOR')
$row.getColumnValue('BRAND')
#end`;

/* ============================================================
   LOAD SAMPLE
   ============================================================ */

function loadSample() {
  if (dataJson) {
    dataJson.value = JSON.stringify(SAMPLE_DATA, null, 2);
  }

  renderPreview();
}

/* ============================================================
   LOAD EXAMPLE
   ============================================================ */

function loadExample() {
  if (eplCode) {
    eplCode.value = SAMPLE_EPL;
  }

  if (layers) {
    layers.value = "2";
  }

  loadSample();
}

/* ============================================================
   BUTTONS
   ============================================================ */

if ($("previewBtn")) {
  $("previewBtn").addEventListener("click", renderPreview);
}

if ($("loadExampleBtn")) {
  $("loadExampleBtn").addEventListener("click", loadExample);
}

if ($("loadSampleBtn")) {
  $("loadSampleBtn").addEventListener("click", loadSample);
}

if ($("clearBtn")) {
  $("clearBtn").addEventListener("click", () => {
    if (eplCode) {
      eplCode.value = "";
    }

    renderPreview();
  });
}

/* ============================================================
   ZOOM BUTTONS
   ============================================================ */

if ($("zoomInBtn")) {
  $("zoomInBtn").addEventListener("click", () => {
    state.zoom = Math.min(3, state.zoom + 0.1);

    applyZoom();
  });
}

if ($("zoomOutBtn")) {
  $("zoomOutBtn").addEventListener("click", () => {
    state.zoom = Math.max(0.25, state.zoom - 0.1);

    applyZoom();
  });
}

if ($("fitBtn")) {
  $("fitBtn").addEventListener("click", fitPreview);
}

/* ============================================================
   SETTINGS
   ============================================================ */

[labelWidth, labelHeight, dpi, layers, gap]
  .filter(Boolean)
  .forEach((element) => {
    element.addEventListener("input", renderPreview);

    element.addEventListener("change", renderPreview);
  });

/* ============================================================
   EPL LIVE
   ============================================================ */

if (eplCode) {
  eplCode.addEventListener("input", renderPreview);
}

/* ============================================================
   JSON LIVE
   ============================================================ */

if (dataJson) {
  dataJson.addEventListener("input", renderPreview);
}

/* ============================================================
   TAB
   ============================================================ */

if (eplCode) {
  eplCode.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();

    const start = eplCode.selectionStart;

    const end = eplCode.selectionEnd;

    eplCode.value =
      eplCode.value.substring(0, start) + "    " + eplCode.value.substring(end);

    eplCode.selectionStart = eplCode.selectionEnd = start + 4;
  });
}

/* ============================================================
   RESIZE
   ============================================================ */

window.addEventListener("resize", () => {
  if (state.zoom < 1) {
    fitPreview();
  } else {
    applyZoom();
  }
});

/* ============================================================
   INITIAL DATA
   ============================================================ */

if (eplCode && !eplCode.value.trim()) {
  eplCode.value = SAMPLE_EPL;
}

if (dataJson && !dataJson.value.trim()) {
  dataJson.value = JSON.stringify(SAMPLE_DATA, null, 2);
}

/* ============================================================
   START
   ============================================================ */

renderPreview();
