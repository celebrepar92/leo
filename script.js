const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let highlights = [];
let currentPdf = null;

// Atajo de teclado 'H'
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') createHighlightFromSelection();
});

document.getElementById('file-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // LIMPIEZA: Reiniciar todo para el nuevo PDF
    highlights = [];
    document.getElementById('pdf-container').innerHTML = '';
    
    const reader = new FileReader();
    reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        currentPdf = await pdfjsLib.getDocument(typedarray).promise;
        renderAllPages();
    };
    reader.readAsArrayBuffer(file);
};

async function renderAllPages() {
    for (let i = 1; i <= currentPdf.numPages; i++) {
        await renderPage(i);
    }
}

async function renderPage(num) {
    const page = await currentPdf.getPage(num);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    wrapper.id = `page-container-${num}`;
    wrapper.dataset.pageNumber = num;
    wrapper.style.width = viewport.width + 'px';
    wrapper.style.height = viewport.height + 'px';
    
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = viewport.width + 'px';
    textLayerDiv.style.height = viewport.height + 'px';
    
    const textContent = await page.getTextContent();
    await pdfjsLib.renderTextLayer({
        textContent: textContent,
        container: textLayerDiv,
        viewport: viewport,
        textDivs: []
    }).promise;

    wrapper.appendChild(canvas);
    wrapper.appendChild(textLayerDiv);
    document.getElementById('pdf-container').appendChild(wrapper);
}

function createHighlightFromSelection() {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    
    // Buscamos el wrapper de la página donde empezó la selección
    const wrapper = range.startContainer.parentElement.closest('.page-wrapper');
    if (!wrapper) return;

    const pageNum = parseInt(wrapper.dataset.pageNumber);
    const wrapperRect = wrapper.getBoundingClientRect();

    for (let rect of rects) {
        const h = {
            page: pageNum,
            // Calculamos la posición relativa al wrapper, restando el scroll actual
            x: rect.left - wrapperRect.left,
            y: rect.top - wrapperRect.top,
            w: rect.width,
            h: rect.height,
            text: selection.toString()
        };
        
        highlights.push(h);
        drawHighlight(h, wrapper);
    }
    selection.removeAllRanges();
}

function drawHighlight(h, wrapper) {
    const div = document.createElement('div');
    div.className = 'highlight-rect';
    // Usamos coordenadas puras porque el wrapper es "relative"
    div.style.left = `${h.x}px`;
    div.style.top = `${h.y}px`;
    div.style.width = `${h.w}px`;
    div.style.height = `${h.h}px`;
    wrapper.appendChild(div);
}

// Exportar JSON
document.getElementById('export-btn').onclick = () => {
    const data = JSON.stringify(highlights, null, 2);
    const blob = new Blob([data], {type : 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "leo_highlights.json";
    a.click();
};