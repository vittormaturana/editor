const inputFile    = document.getElementById('input-file');
const canvas       = document.getElementById('canvas');
const uploadArea   = document.getElementById('upload-area');
const btnDownload  = document.getElementById('btn-download');
const btnReset     = document.getElementById('btn-reset');
const ctx          = canvas.getContext('2d');

let img = new Image();

// --- Carrega a imagem escolhida ---
inputFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  img.src = url;
});

img.onload = () => {
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  uploadArea.style.display = 'none';
  canvas.style.display = 'block';
  aplicarFiltros();
};

// --- Lê os sliders e monta a string de filtros ---
function getFiltros() {
  const b  = document.getElementById('brightness').value;
  const c  = document.getElementById('contrast').value;
  const s  = document.getElementById('saturate').value;
  const bl = document.getElementById('blur').value;
  const sp = document.getElementById('sepia').value;
  const gr = document.getElementById('grayscale').value;

  return `brightness(${b}%) contrast(${c}%) saturate(${s}%)
          blur(${bl}px) sepia(${sp}%) grayscale(${gr}%)`;
}

// --- Desenha a imagem no canvas com os filtros aplicados ---
function aplicarFiltros() {
    const b  = document.getElementById('brightness').value;
    const c  = document.getElementById('contrast').value;
    const s  = document.getElementById('saturate').value;
    const sp = document.getElementById('sepia').value;
    const gr = document.getElementById('grayscale').value;
    const sh = document.getElementById('sharpness').value; // 0 a 3
  
    // 1. Aplica os filtros normais primeiro
    ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) sepia(${sp}%) grayscale(${gr}%)`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  
    // 2. Aplica nitidez só se o valor for maior que zero
    if (parseFloat(sh) > 0) {
      aplicarNitidez(parseFloat(sh));
    }
  }
  
  function aplicarNitidez(intensidade) {
    // Canvas auxiliar com a imagem levemente borrada
    const aux = document.createElement('canvas');
    aux.width  = canvas.width;
    aux.height = canvas.height;
    const ctxAux = aux.getContext('2d');
  
    // Borra a cópia (quanto mais blur, mais nitidez aparente no resultado)
    ctxAux.filter = `blur(${intensidade}px)`;
    ctxAux.drawImage(canvas, 0, 0);
  
    // Pega os pixels das duas versões
    const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const borrada  = ctxAux.getImageData(0, 0, canvas.width, canvas.height);
    const saida    = ctx.createImageData(canvas.width, canvas.height);
  
    const fator = 1.5; // força do efeito — aumente para mais nitidez
  
    for (let i = 0; i < original.data.length; i += 4) {
      saida.data[i]     = clamp(original.data[i]     + fator * (original.data[i]     - borrada.data[i]));
      saida.data[i + 1] = clamp(original.data[i + 1] + fator * (original.data[i + 1] - borrada.data[i + 1]));
      saida.data[i + 2] = clamp(original.data[i + 2] + fator * (original.data[i + 2] - borrada.data[i + 2]));
      saida.data[i + 3] = original.data[i + 3]; // mantém o alpha
    }
  
    ctx.putImageData(saida, 0, 0);
  }
  
  // Garante que o valor fica entre 0 e 255
  function clamp(val) {
    return Math.min(255, Math.max(0, Math.round(val)));
  }

// --- Atualiza o display do valor e redesenha quando um slider muda ---
document.querySelectorAll('input[type="range"]').forEach(slider => {
  slider.addEventListener('input', () => {
    document.getElementById('val-' + slider.id).textContent = slider.value;
    aplicarFiltros();
  });
});

// --- Reseta todos os sliders ---
btnReset.addEventListener('click', () => {
  const defaults = {
    brightness: 100, contrast: 100,
    saturate: 100,   blur: 0,
    sepia: 0,        grayscale: 0
  };

  Object.entries(defaults).forEach(([id, val]) => {
    document.getElementById(id).value = val;
    document.getElementById('val-' + id).textContent = val;
  });

  aplicarFiltros();
});

// --- Exporta a imagem editada ---
btnDownload.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'foto-editada.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});