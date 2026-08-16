/* ============================================================
   UNICOMMERCE EPL / VELOCITY PREVIEWER
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
   SAMPLE DATA
============================================================ */

const SAMPLE_DATA = {
  ProductCode: "ETH-CAP-ESLC-BLUE",

  SKU: "ETH-CAP-ESLC-BLUE",

  MRP: "999.00",

  Name: "Ethansports",

  Color: "BLUE",

  Size: "M",

  QTY: "1",

  Brand: "Ethansports",

  Barcode: "8901234567890",

  Category: "CAP",

  Description: "Blue Sports Cap",
};

/* ============================================================
   REALISTIC TEST EPL

   Notice the correct A syntax:

   A20,10,0,1,2,2,N,"Ethansports"

   This should now display text.
============================================================ */

const SAMPLE_EPL = `FK"1"
FS"1"

V00,50,N,""
V01,50,N,""
V02,50,N,""
V03,50,N,""
V04,50,N,""
V05,50,N,""

A20,10,0,1,2,2,N,"Ethansports"
A20,45,0,1,1,2,N,"SKU:"V00
A20,70,0,1,1,1,N,"QTY:"V02
A20,95,0,1,1,1,N,"MRP:"V01
A20,120,0,1,1,1,N,"COLOR:"V03
A20,145,0,1,1,1,N,"SIZE:"V04
B20,170,0,1,2,3,30,N,V05

A350,10,0,1,2,2,N,"{{Name}}"
A350,45,0,1,1,2,N,"SKU:"$row.getColumnValue('SKU')
A350,70,0,1,1,1,N,"QTY:"$row.getColumnValue('QTY')
A350,95,0,1,1,1,N,"MRP:"$row.getColumnValue('MRP')
A350,120,0,1,1,1,N,"COLOR:"$row.getColumnValue('Color')
A350,145,0,1,1,1,N,"SIZE:"$row.getColumnValue('Size')
B350,170,0,1,2,3,30,N,$row.getColumnValue('Barcode')

#foreach($row in $rows)
FR"1"
?
$row.getColumnValue('ProductCode')
$row.getColumnValue('MRP')
#end

FE`;

/* ============================================================
   INCH -> DOTS
============================================================ */

function inchToDots(value, dpiValue) {
  return Math.round(Number(value) * Number(dpiValue));
}

/* ============================================================
   CALCULATE PAPER
============================================================ */

function calculateDimensions() {
  const widthInch = Math.max(0.1, parseFloat(labelWidth.value) || 2);

  const heightInch = Math.max(0.1, parseFloat(labelHeight.value) || 1);

  const dpiValue = parseInt(dpi.value, 10) || 203;

  const layerCount = Math.max(1, parseInt(layers.value, 10) || 1);

  const gapInch = Math.max(0, parseFloat(gap.value) || 0);

  state.dpi = dpiValue;

  state.layers = layerCount;

  state.labelWidthDots = inchToDots(widthInch, dpiValue);

  state.labelHeightDots = inchToDots(heightInch, dpiValue);

  state.gapDots = inchToDots(gapInch, dpiValue);

  state.totalWidthDots =
    state.labelWidthDots * state.layers +
    state.gapDots * Math.max(0, state.layers - 1);

  state.totalHeightDots = state.labelHeightDots;

  previewInfo.textContent =
    `${widthInch} × ${heightInch} inch | ` +
    `${state.layers} layer` +
    (state.layers > 1 ? "s" : "");

  physicalInfo.textContent = `${widthInch} × ${heightInch} inch`;

  dotInfo.textContent =
    `${state.totalWidthDots} × ` +
    `${state.totalHeightDots} dots @ ` +
    `${dpiValue} DPI`;

  layerInfo.textContent = state.layers;
}

/* ============================================================
   JSON PARSER
============================================================ */

function parseJsonData() {
  try {
    const data = JSON.parse(dataJson.value || "{}");

    if (!data || Array.isArray(data) || typeof data !== "object") {
      throw new Error("JSON must be an object.");
    }

    jsonStatus.textContent = "✓ JSON is valid";

    jsonStatus.className = "json-status ok";

    return data;
  } catch (error) {
    jsonStatus.textContent = `✗ ${error.message}`;

    jsonStatus.className = "json-status error";

    return {};
  }
}

/* ============================================================
   DATA VALUE
============================================================ */

function getDataValue(data, field) {
  if (field === undefined || field === null) {
    return "";
  }

  const name = String(field).trim();

  /*
    Direct field.
  */

  if (Object.prototype.hasOwnProperty.call(data, name)) {
    return valueToString(data[name]);
  }

  /*
    Case insensitive.
  */

  const lower = name.toLowerCase();

  const actualKey = Object.keys(data).find(
    (key) => key.toLowerCase() === lower,
  );

  if (actualKey) {
    return valueToString(data[actualKey]);
  }

  return "";
}

/* ============================================================
   VALUE TO STRING
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
   VELOCITY REPLACEMENT

   Supports:

   $row.getColumnValue('SKU')

   $row.getColumnValue("SKU")

   {{SKU}}

   ${SKU}
============================================================ */

function replaceVelocity(text, data) {
  let result = String(text || "");

  /*
    $row.getColumnValue('field')
  */

  result = result.replace(
    /\$row\.getColumnValue\(\s*['"]([^'"]+)['"]\s*\)/g,

    (complete, field) => {
      return getDataValue(data, field);
    },
  );

  /*
    {{field}}
  */

  result = result.replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,

    (complete, field) => {
      return getDataValue(data, field.trim());
    },
  );

  /*
    ${field}
  */

  result = result.replace(
    /\$\{\s*([^{}]+?)\s*\}/g,

    (complete, field) => {
      return getDataValue(data, field.trim());
    },
  );

  return result;
}

/* ============================================================
   V00-V99

   Automatic mapping.

   V00 = ProductCode/SKU
   V01 = MRP
   V02 = QTY
   V03 = Color
   V04 = Size
   V05 = Barcode

   No mapping UI.
============================================================ */

function createVariables(code, data) {
  const variables = {};

  /*
    Find V declarations.
  */

  const regex = /^V(\d+),/gm;

  let match;

  while ((match = regex.exec(code)) !== null) {
    const variable = "V" + String(match[1]).padStart(2, "0");

    variables[variable] = "";
  }

  const automaticFields = {
    V00: ["ProductCode", "SKU"],

    V01: ["MRP"],

    V02: ["QTY", "Quantity"],

    V03: ["Color"],

    V04: ["Size"],

    V05: ["Barcode", "ProductCode", "SKU"],
  };

  Object.keys(variables).forEach((variable) => {
    const fields = automaticFields[variable] || [];

    /*
        Search automatic fields.
      */

    for (const field of fields) {
      const value = getDataValue(data, field);

      if (value !== "") {
        variables[variable] = value;

        return;
      }
    }

    /*
        Direct JSON V00 etc.
      */

    const direct = getDataValue(data, variable);

    if (direct !== "") {
      variables[variable] = direct;
    }
  });

  return variables;
}

/* ============================================================
   REPLACE V00-V99
============================================================ */

function replaceVariables(text, variables) {
  return String(text || "").replace(
    /\bV\d{2}\b/g,

    (variable) => {
      if (variables[variable] !== undefined) {
        return variables[variable];
      }

      return "";
    },
  );
}

/* ============================================================
   SPLIT EPL PARAMETERS

   Commas inside quotes are preserved.
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
   CLEAN TEXT DATA

   Handles:

   "Hello"

   "SKU:"V00

   "SKU:"$row.getColumnValue('SKU')

   {{SKU}}
============================================================ */

function cleanText(raw, variables, data) {
  let text = String(raw || "");

  /*
    Velocity first.
  */

  text = replaceVelocity(text, data);

  /*
    V00 etc.
  */

  text = replaceVariables(text, variables);

  /*
    Remove EPL quotes.

    "SKU:"V00
    becomes
    SKU:ABC123
  */

  text = text.replace(/"/g, "");

  return text;
}

/* ============================================================
   PARSE EPL TEXT COMMAND

   CORRECT EPL:

   A20,10,0,1,2,2,N,"Ethansports"

   Parameters:

   X
   Y
   Rotation
   Font
   Horizontal multiplier
   Vertical multiplier
   Reverse
   DATA
============================================================ */

function parseTextCommand(line, variables, data) {
  /*
    Must start with A + X.
  */

  if (!/^A\s*-?\d+/i.test(line)) {
    return null;
  }

  /*
    Remove first A.
  */

  const body = line.substring(1).trim();

  /*
    X ends at first comma.
  */

  const firstComma = body.indexOf(",");

  if (firstComma === -1) {
    return null;
  }

  const x = parseInt(body.substring(0, firstComma), 10);

  if (Number.isNaN(x)) {
    return null;
  }

  /*
    Remaining parameters.

    For:

    A20,10,0,1,2,2,N,"Hello"

    this becomes:

    10
    0
    1
    2
    2
    N
    "Hello"

    = 7 items.
  */

  const remaining = body.substring(firstComma + 1);

  const parts = splitEpl(remaining);

  /*
    IMPORTANT:

    EPL A command requires 7 parameters
    after X.
  */

  if (parts.length < 7) {
    return null;
  }

  const y = parseInt(parts[0], 10) || 0;

  const rotation = parseInt(parts[1], 10) || 0;

  const font = parts[2] || "1";

  const horizontal = Math.max(1, parseInt(parts[3], 10) || 1);

  const vertical = Math.max(1, parseInt(parts[4], 10) || 1);

  const reverse = (parts[5] || "N").replace(/"/g, "").toUpperCase();

  /*
    DATA starts at index 6.

    We join the rest because the text may
    contain commas.
  */

  const rawData = parts.slice(6).join(",");

  const text = cleanText(rawData, variables, data);

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
   PARSE BARCODE COMMAND

   CORRECT EPL:

   B20,170,0,1,2,3,30,N,V05

   Parameters after X:

   Y
   Rotation
   Barcode type
   Narrow
   Wide
   Height
   Human readable
   Data
============================================================ */

function parseBarcodeCommand(line, variables, data) {
  if (!/^B\s*-?\d+/i.test(line)) {
    return null;
  }

  const body = line.substring(1).trim();

  const parts = splitEpl(body);

  /*
    X + 8 remaining fields.
  */

  if (parts.length < 9) {
    return null;
  }

  const x = parseInt(parts[0], 10) || 0;

  const y = parseInt(parts[1], 10) || 0;

  const rotation = (((parseInt(parts[2], 10) || 0) % 4) + 4) % 4;

  const barcodeType = String(parts[3] || "1").replace(/"/g, "");

  const narrowBar = Math.max(1, parseInt(parts[4], 10) || 1);

  const wideBar = Math.max(
    narrowBar + 1,
    parseInt(parts[5], 10) || narrowBar * 2,
  );

  const height = Math.max(10, parseInt(parts[6], 10) || 40);

  const humanReadable = String(parts[7] || "N")
    .replace(/"/g, "")
    .toUpperCase();

  /*
    DATA is index 8.
  */

  let barcodeData = parts.slice(8).join(",");

  barcodeData = replaceVelocity(barcodeData, data);

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
   PARSE EPL
============================================================ */

function parseEpl(code, variables, data) {
  const objects = [];

  const lines = code.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      return;
    }

    /*
        Ignore comments.
      */

    if (line.startsWith(";")) {
      return;
    }

    /*
        EPL TEXT
      */

    if (/^A\s*-?\d+/i.test(line)) {
      const object = parseTextCommand(line, variables, data);

      if (object) {
        object.line = index + 1;

        objects.push(object);
      }

      return;
    }

    /*
        EPL BARCODE
      */

    if (/^B\s*-?\d+/i.test(line)) {
      const object = parseBarcodeCommand(line, variables, data);

      if (object) {
        object.line = index + 1;

        objects.push(object);
      }

      return;
    }

    /*
        Everything else is kept in textarea
        but isn't a visual object.

        Examples:

        FK
        FS
        V
        FR
        ?
        #foreach
        #end
        $row.getColumnValue
        FE
        PA
      */
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
   GET LABEL X
============================================================ */

function getLabelStartX(layerIndex) {
  return layerIndex * (state.labelWidthDots + state.gapDots);
}

/* ============================================================
   FIND LAYER
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

function createLabels() {
  for (let i = 0; i < state.layers; i++) {
    const label = document.createElement("div");

    label.className = "epl-label";

    label.style.left = `${getLabelStartX(i)}px`;

    label.style.top = "0px";

    label.style.width = `${state.labelWidthDots}px`;

    label.style.height = `${state.labelHeightDots}px`;

    /*
      Grid.
    */

    const grid = document.createElement("div");

    grid.className = "coordinate-grid";

    label.appendChild(grid);

    /*
      Layer name.
    */

    const title = document.createElement("div");

    title.className = "layer-title";

    title.textContent = `Layer ${i + 1}`;

    label.appendChild(title);

    previewPaper.appendChild(label);
  }
}

/* ============================================================
   CREATE TEXT ELEMENT
============================================================ */

function createTextElement(object) {
  const element = document.createElement("div");

  element.className = "epl-text";

  element.textContent = object.text;

  const fontSize = getFontSize(object.font);

  element.style.left = `${object.localX}px`;

  element.style.top = `${object.y}px`;

  element.style.fontSize = `${fontSize}px`;

  element.style.fontWeight = "bold";

  element.style.color = "#000000";

  element.style.background = "transparent";

  element.style.visibility = "visible";

  element.style.opacity = "1";

  element.style.display = "block";

  element.style.whiteSpace = "pre";

  element.style.width = "max-content";

  element.style.zIndex = "100";

  /*
    Scale + rotation.

    CSS applies scale first and rotation second.
  */

  element.style.transform = `scale(
      ${object.horizontal},
      ${object.vertical}
    )
    rotate(
      ${object.rotation * 90}deg
    )`;

  /*
    Reverse image.
  */

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

  wrapper.style.left = `${object.localX}px`;

  wrapper.style.top = `${object.y}px`;

  wrapper.style.zIndex = "20";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  wrapper.appendChild(svg);

  const data = object.data || "000000";

  const format = getBarcodeFormat(object.barcodeType);

  try {
    JsBarcode(
      svg,

      data,

      {
        format,

        width: Math.max(1, object.narrowBar),

        height: object.height,

        displayValue: object.humanReadable === "Y",

        margin: 0,

        fontSize: 10,

        textMargin: 2,
      },
    );
  } catch (error) {
    console.warn("Barcode fallback:", error);

    try {
      JsBarcode(
        svg,

        data,

        {
          format: "CODE128",

          width: Math.max(1, object.narrowBar),

          height: object.height,

          displayValue: object.humanReadable === "Y",

          margin: 0,
        },
      );
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
   VALIDATION
============================================================ */

function validateObject(object, bounds) {
  if (object.localX < 0) {
    state.errors.push(
      `Line ${object.line}: X is outside Layer ${object.layer + 1}.`,
    );
  }

  if (object.localX + bounds.width > state.labelWidthDots) {
    state.errors.push(
      `Line ${object.line}: object exceeds Layer ${object.layer + 1} width.`,
    );
  }

  if (object.y < 0) {
    state.errors.push(`Line ${object.line}: negative Y coordinate.`);
  }

  if (object.y + bounds.height > state.labelHeightDots) {
    state.errors.push(`Line ${object.line}: object exceeds label height.`);
  }
}

/* ============================================================
   OVERLAPS
============================================================ */

function detectOverlaps(objects) {
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];

      const b = objects[j];

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
          `Possible overlap between line ${a.line} and line ${b.line}.`,
        );
      }
    }
  }
}

/* ============================================================
   RENDER
============================================================ */

function renderPreview() {
  /*
    1. Dimensions
  */

  calculateDimensions();

  /*
    2. Reset
  */

  state.objects = [];

  state.errors = [];

  state.warnings = [];

  /*
    3. Clear
  */

  previewPaper.innerHTML = "";

  /*
    4. Paper dimensions
  */

  previewPaper.style.width = `${state.totalWidthDots}px`;

  previewPaper.style.height = `${state.totalHeightDots}px`;

  /*
    5. Labels
  */

  createLabels();

  /*
    6. JSON
  */

  const data = parseJsonData();

  /*
    7. Variables
  */

  const variables = createVariables(eplCode.value, data);

  /*
    8. Parse EPL
  */

  const objects = parseEpl(eplCode.value, variables, data);

  /*
    9. Labels
  */

  const labels = [...previewPaper.querySelectorAll(".epl-label")];

  /*
    10. Render
  */

  objects.forEach((object) => {
    const layer = getLayerForX(object.x);

    object.layer = layer;

    object.localX = getLocalX(object.x, layer);

    const label = labels[layer];

    if (!label) {
      return;
    }

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

    /*
        Store bounds.
      */

    object.bounds = bounds;

    /*
        Validate.
      */

    validateObject(object, bounds);

    /*
        Boundary.
      */

    const boundary = document.createElement("div");

    boundary.className = "object-boundary";

    boundary.style.left = `${object.localX}px`;

    boundary.style.top = `${object.y}px`;

    boundary.style.width = `${Math.max(1, bounds.width)}px`;

    boundary.style.height = `${Math.max(1, bounds.height)}px`;

    label.appendChild(boundary);

    /*
        ACTUAL OBJECT

        Text has z-index 100.
      */

    label.appendChild(element);

    state.objects.push(object);
  });

  /*
    Overlaps.
  */

  detectOverlaps(state.objects);

  /*
    Object count.
  */

  objectInfo.textContent = state.objects.length;

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
   VALIDATION UI
============================================================ */

function showValidation() {
  validationMessages.innerHTML = "";

  /*
    Everything valid.
  */

  if (state.errors.length === 0 && state.warnings.length === 0) {
    validationSummary.textContent = "Valid";

    validationSummary.style.color = "#166534";

    addValidationMessage("✓ Text and barcode objects detected.", "success");

    statusInfo.textContent = "Valid";

    statusInfo.className = "status-ready";

    return;
  }

  /*
    Errors.
  */

  if (state.errors.length > 0) {
    validationSummary.textContent = `${state.errors.length} error(s)`;

    validationSummary.style.color = "#991b1b";

    statusInfo.textContent = "Errors";

    statusInfo.className = "status-error";

    state.errors.forEach((message) => {
      addValidationMessage(message, "error");
    });
  }

  /*
    Warnings.
  */

  state.warnings.forEach((message) => {
    addValidationMessage(message, "warning");
  });

  if (state.errors.length === 0 && state.warnings.length > 0) {
    validationSummary.textContent = `${state.warnings.length} warning(s)`;

    statusInfo.textContent = "Warnings";

    statusInfo.className = "status-warning";
  }
}

function addValidationMessage(message, type) {
  const element = document.createElement("div");

  element.className = `validation-message ${type}`;

  element.textContent = message;

  validationMessages.appendChild(element);
}

/* ============================================================
   ZOOM
============================================================ */

function applyZoom() {
  previewPaper.style.transform = `scale(${state.zoom})`;

  previewPaper.style.transformOrigin = "top left";

  zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;

  /*
    Expand scroll area according to zoom.
  */

  const scaledWidth = state.totalWidthDots * state.zoom;

  const scaledHeight = state.totalHeightDots * state.zoom;

  previewCanvas.style.width = `${Math.max(
    scaledWidth + 100,
    previewViewport.clientWidth,
  )}px`;

  previewCanvas.style.height = `${Math.max(
    scaledHeight + 100,
    previewViewport.clientHeight,
  )}px`;
}

/* ============================================================
   FIT
============================================================ */

function fitPreview() {
  /*
    Don't fit if viewport is not ready.
  */

  if (previewViewport.clientWidth <= 0) {
    return;
  }

  previewPaper.style.transform = "none";

  const availableWidth = Math.max(100, previewViewport.clientWidth - 100);

  const availableHeight = Math.max(100, previewViewport.clientHeight - 100);

  let newZoom = Math.min(
    availableWidth / state.totalWidthDots,

    availableHeight / state.totalHeightDots,
  );

  newZoom = Math.max(0.25, Math.min(newZoom, 2));

  state.zoom = newZoom;

  applyZoom();
}

/* ============================================================
   LOAD SAMPLE
============================================================ */

function loadSample() {
  dataJson.value = JSON.stringify(SAMPLE_DATA, null, 2);

  renderPreview();
}

/* ============================================================
   LOAD EXAMPLE
============================================================ */

function loadExample() {
  eplCode.value = SAMPLE_EPL;

  layers.value = "2";

  loadSample();
}

/* ============================================================
   PREVIEW BUTTON
============================================================ */

$("previewBtn").addEventListener("click", renderPreview);

/* ============================================================
   LOAD EXAMPLE
============================================================ */

$("loadExampleBtn").addEventListener("click", loadExample);

/* ============================================================
   LOAD SAMPLE
============================================================ */

$("loadSampleBtn").addEventListener("click", loadSample);

/* ============================================================
   CLEAR
============================================================ */

$("clearBtn").addEventListener("click", () => {
  eplCode.value = "";

  renderPreview();
});

/* ============================================================
   ZOOM IN
============================================================ */

$("zoomInBtn").addEventListener("click", () => {
  state.zoom = Math.min(3, state.zoom + 0.1);

  applyZoom();
});

/* ============================================================
   ZOOM OUT
============================================================ */

$("zoomOutBtn").addEventListener("click", () => {
  state.zoom = Math.max(0.25, state.zoom - 0.1);

  applyZoom();
});

/* ============================================================
   FIT
============================================================ */

$("fitBtn").addEventListener("click", fitPreview);

/* ============================================================
   SETTINGS LIVE UPDATE
============================================================ */

[labelWidth, labelHeight, dpi, layers, gap].forEach((element) => {
  element.addEventListener("input", renderPreview);

  element.addEventListener("change", renderPreview);
});

/* ============================================================
   EPL LIVE UPDATE
============================================================ */

eplCode.addEventListener("input", renderPreview);

/* ============================================================
   JSON LIVE UPDATE
============================================================ */

dataJson.addEventListener("input", renderPreview);

/* ============================================================
   TAB SUPPORT
============================================================ */

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

eplCode.value = SAMPLE_EPL;

dataJson.value = JSON.stringify(SAMPLE_DATA, null, 2);

/* ============================================================
   START
============================================================ */

renderPreview();
