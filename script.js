const inputFile = document.getElementById('input-file');
const canvas = document.getElementById('canvas');
const uploadArea = document.getElementById('upload-area');
const btnDownload = document.getElementById('btn-download');
const btnReset = document.getElementById('btn-reset');
const ctx = canvas.getContext('2d');

// --- Variáveis de Estado Globais ---
let img = new Image();
let desenhando = false;
let ferramentaAtual = 'pincel';
let historicoUndo = [];
let historicoRedo = [];
let modoCropVisual = false;
let cropInicioX = 0, cropInicioY = 0;
let cropFimX = 0, cropFimY = 0;

// Função para salvar o estado atual do projeto
function salvarEstado() {
  // Guarda em formato de imagem (dataURL) tanto a foto base quanto a camada de desenho
  const estado = {
    imgSrc: img.src,
    desenhoSrc: camada.toDataURL(),
    width: canvas.width,
    height: canvas.height
  };

  historicoUndo.push(estado);
  historicoRedo = []; // Sempre que uma nova ação é feita, limpa o Redo
}

// Criação da camada de desenho (declarada no topo para evitar erros de escopo)
const camada = document.createElement('canvas');
const ctxCamada = camada.getContext('2d');

// --- Carrega a imagem escolhida via botão clássico com VALIDAÇÃO ---
inputFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Limite de tamanho: 10MB (10 * 1024 * 1024 bytes)
  const limiteTamanho = 10 * 1024 * 1024;

  // Validação de Tipo
  if (!file.type.startsWith('image/')) {
    alert('Por favor, selecione apenas arquivos de imagem válidos (PNG, JPG, WEBP, etc).');
    inputFile.value = ''; // Limpa o input
    return;
  }

  // Validação de Tamanho
  if (file.size > limiteTamanho) {
    alert('A imagem é muito grande! Escolha um arquivo de até 10 MB para evitar travamentos.');
    inputFile.value = ''; // Limpa o input
    return;
  }

  const url = URL.createObjectURL(file);
  historicoUndo = [];
  historicoRedo = [];
  img.src = url;
});

// ============================================================
// SISTEMA DE DRAG AND DROP (CORRIGIDO E ATIVO DESDE O INÍCIO)
// ============================================================

// 1. BLINDAGEM TOTAL: Impede o navegador de abrir a imagem em nova aba na janela inteira
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(nomeEvento => {
  window.addEventListener(nomeEvento, (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, false);
});

// 2. Adiciona o efeito visual quando o arquivo entra na área de upload
['dragenter', 'dragover'].forEach(nomeEvento => {
  uploadArea.addEventListener(nomeEvento, (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('dragover');
  });
});

// 3. Remove o efeito visual se o usuário tirar o arquivo da área
['dragleave', 'drop'].forEach(nomeEvento => {
  uploadArea.addEventListener(nomeEvento, (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
  });
});

// 4. Captura o arquivo OU o link da imagem e força a abertura DENTRO do editor
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.remove('dragover');

  // Tentativa A: É um arquivo arrastado do computador local? (COM VALIDAÇÃO)
  const arquivos = e.dataTransfer.files;
  if (arquivos && arquivos.length > 0) {
    const arquivo = arquivos[0];
    const limiteTamanho = 10 * 1024 * 1024; // 10MB

    if (!arquivo.type.startsWith('image/')) {
      alert('Por favor, solte apenas arquivos de imagem válidos!');
      return;
    }

    if (arquivo.size > limiteTamanho) {
      alert('Esta imagem passa do limite de 10 MB. Tente um arquivo mais leve!');
      return;
    }

    historicoUndo = [];
    historicoRedo = [];
    img.src = URL.createObjectURL(arquivo);
    return;
  }

  // Tentativa B: É um link de imagem vindo de OUTRA ABA?
  const urlUriList = e.dataTransfer.getData('text/uri-list');
  const urlPlain = e.dataTransfer.getData('text/plain');
  const htmlTexto = e.dataTransfer.getData('text/html');

  let urlFinal = urlUriList || urlPlain;

  if (htmlTexto && (!urlFinal || !urlFinal.startsWith('http'))) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlTexto, 'text/html');
    const elementoImg = doc.querySelector('img');
    if (elementoImg && elementoImg.src) {
      urlFinal = elementoImg.src;
    }
  }

  if (urlFinal && (urlFinal.startsWith('http') || urlFinal.startsWith('data:image'))) {
    img.crossOrigin = 'anonymous';
    historicoUndo = [];
    historicoRedo = [];
    img.src = urlFinal;
  } else {
    alert('Não conseguimos extrair a imagem dessa aba diretamente. Dica: clique com o botão direito na imagem, escolha "Copiar imagem" ou salve-a no computador e arraste o arquivo!');
  }
});

// --- FUNÇÃO ÚNICA DE CARREGAMENTO ---
img.onload = () => {
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  // Ajusta o tamanho do canvas principal e da camada de desenho
  canvas.width = w;
  canvas.height = h;
  camada.width = w;
  camada.height = h;

  // Limpa desenhos anteriores se for um novo upload
  ctxCamada.clearRect(0, 0, w, h);

  // Preenche/Atualiza os campos numéricos da aba Redimensionar
  if (document.getElementById('resize-w')) {
    document.getElementById('resize-w').value = w;
    document.getElementById('resize-h').value = h;
    document.getElementById('crop-w').value = w;
    document.getElementById('crop-h').value = h;
    document.getElementById('crop-x').value = 0;
    document.getElementById('crop-y').value = 0;
  }

  // Altera a exibição da tela
  uploadArea.style.display = 'none';
  canvas.style.display = 'block';

  aplicarFiltros();
};

// --- Lê os sliders e monta a string de filtros ---
function getFiltros() {
  const b = document.getElementById('brightness').value;
  const c = document.getElementById('contrast').value;
  const s = document.getElementById('saturate').value;
  const sp = document.getElementById('sepia').value;
  const gr = document.getElementById('grayscale').value;

  return `brightness(${b}%) contrast(${c}%) saturate(${s}%) sepia(${sp}%) grayscale(${gr}%)`;
}

// --- Desenha a imagem no canvas com os filtros aplicados ---
function aplicarFiltros() {
  const sh = document.getElementById('sharpness').value;

  ctx.filter = getFiltros();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  ctx.filter = 'none';

  if (parseFloat(sh) > 0) {
    aplicarNitidez(parseFloat(sh));
  }
}

function aplicarNitidez(intensidade) {
  const aux = document.createElement('canvas');
  aux.width = canvas.width;
  aux.height = canvas.height;
  const ctxAux = aux.getContext('2d');

  ctxAux.filter = `blur(${intensidade}px)`;
  ctxAux.drawImage(canvas, 0, 0);

  const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const borrada = ctxAux.getImageData(0, 0, canvas.width, canvas.height);
  const saida = ctx.createImageData(canvas.width, canvas.height);

  const fator = 1.5;

  for (let i = 0; i < original.data.length; i += 4) {
    saida.data[i] = clamp(original.data[i] + fator * (original.data[i] - borrada.data[i]));
    saida.data[i + 1] = clamp(original.data[i + 1] + fator * (original.data[i + 1] - borrada.data[i + 1]));
    saida.data[i + 2] = clamp(original.data[i + 2] + fator * (original.data[i + 2] - borrada.data[i + 2]));
    saida.data[i + 3] = original.data[i + 3];
  }

  ctx.putImageData(saida, 0, 0);
}

function clamp(val) {
  return Math.min(255, Math.max(0, Math.round(val)));
}

// --- Atualiza os sliders (CORRIGIDO: Filtros aplicam filtros, Pincel não limpa a tela) ---
document.querySelectorAll('input[type="range"]').forEach(slider => {
  slider.addEventListener('input', () => {
    // Atualiza o texto com o valor atual (ex: 6px, 100%)
    const elementoValor = document.getElementById('val-' + slider.id);
    if (elementoValor) {
      elementoValor.textContent = slider.value;
    }

    // Se o slider alterado for de desenho (espessura ou opacidade), NÃO aplica filtros
    if (slider.id === 'espessura' || slider.id === 'opacidade') {
      return; // Apenas guarda o valor e sai, sem sumir com o desenho da tela!
    }

    // Se for um slider de imagem (brilho, contraste, etc), aí sim renderiza as mudanças
    if (canvas.style.display !== 'none') {
      renderizar();
    }
  });
});

btnReset.addEventListener('click', () => {
  const defaults = {
    brightness: 100, contrast: 100,
    saturate: 100, blur: 0,
    sepia: 0, grayscale: 0
  };

  Object.entries(defaults).forEach(([id, val]) => {
    const input = document.getElementById(id);
    const label = document.getElementById('val-' + id);
    if (input) input.value = val;
    if (label) label.textContent = val;
  });

  aplicarFiltros();
});

// --- Exporta a imagem editada ---
// ============================================================
// SISTEMA DE DOWNLOAD E COMPARTILHAMENTO (MODAL ATUALIZADO)
// ============================================================
const modalSalvar = document.getElementById('modal-salvar');
const inputNomeArquivo = document.getElementById('input-nome-arquivo');
const selectFormato = document.getElementById('select-formato'); // Captura o novo select
const btnConfirmarDown = document.getElementById('btn-confirmar-download');
const btnCompartilhar = document.getElementById('btn-compartilhar');
const btnFecharModal = document.getElementById('btn-fechar-modal');

// 1. Ao clicar no botão principal do Header, apenas abre a mini tela
btnDownload.addEventListener('click', () => {
  if (canvas.style.display === 'none') return;
  modalSalvar.style.display = 'flex';
});

// 2. Fecha a mini tela se o usuário cancelar
btnFecharModal.addEventListener('click', () => {
  modalSalvar.style.display = 'none';
});

// 3. Efetua o Download com o nome e formato personalizados
btnConfirmarDown.addEventListener('click', () => {
  let nome = inputNomeArquivo.value.trim();
  if (!nome) nome = 'foto-editada';

  // Descobre o formato (image/png, image/jpeg, etc.) e a extensão (.png, .jpg)
  const formatoMime = selectFormato.value;
  const extensao = formatoMime.split('/')[1] === 'jpeg' ? 'jpg' : formatoMime.split('/')[1];

  const link = document.createElement('a');
  link.download = `${nome}.${extensao}`;
  link.href = canvas.toDataURL(formatoMime, 0.9); // 0.9 é a qualidade para o JPEG/WEBP
  link.click();

  modalSalvar.style.display = 'none';
});

// 4. Faz o Compartilhamento do arquivo no formato selecionado
btnCompartilhar.addEventListener('click', async () => {
  let nome = inputNomeArquivo.value.trim();
  if (!nome) nome = 'foto-editada';

  const formatoMime = selectFormato.value;
  const extensao = formatoMime.split('/')[1] === 'jpeg' ? 'jpg' : formatoMime.split('/')[1];

  try {
    // Passa o formatoMime escolhido para a conversão em Blob
    canvas.toBlob(async (blob) => {
      const arquivo = new File([blob], `${nome}.${extensao}`, { type: formatoMime });

      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        await navigator.share({
          files: [arquivo],
          title: 'PortArt Editor',
          text: 'Olha a imagem que editei no PortArt!'
        });
      } else {
        alert('O compartilhamento direto não é suportado pelo seu navegador atual. Use o botão Baixar.');
      }
    }, formatoMime, 0.9);
  } catch (erro) {
    console.error('Erro ao compartilhar:', erro);
  }
});

// ============================================================
// ABAS DO PAINEL
// ============================================================
document.querySelectorAll('.aba').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.aba').forEach(b => b.classList.remove('ativa'));
    btn.classList.add('ativa');

    const aba = btn.dataset.aba;
    document.getElementById('painel-ajustes').style.display = aba === 'ajustes' ? 'block' : 'none';
    document.getElementById('painel-desenho').style.display = aba === 'desenho' ? 'block' : 'none';
    document.getElementById('painel-redimensionar').style.display = aba === 'redimensionar' ? 'block' : 'none';
  });
});

// ============================================================
// DESENHO LIVRE
// ============================================================
function renderizar() {
  aplicarFiltros();
  ctx.drawImage(camada, 0, 0);
}

function getCoordenadas(e) {
  const rect = canvas.getBoundingClientRect();
  const escX = canvas.width / rect.width;
  const escY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: (clientX - rect.left) * escX, y: (clientY - rect.top) * escY };
}

function configurarPincel() {
  const cor = document.getElementById('cor-pincel').value;
  const espessura = document.getElementById('espessura').value;
  const opacidade = document.getElementById('opacidade').value / 100;

  ctxCamada.lineCap = 'round';
  ctxCamada.lineJoin = 'round';
  ctxCamada.lineWidth = espessura;

  if (ferramentaAtual === 'borracha') {
    ctxCamada.globalCompositeOperation = 'destination-out';
    ctxCamada.globalAlpha = 1;
    ctxCamada.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctxCamada.globalCompositeOperation = 'source-over';
    ctxCamada.globalAlpha = opacidade;
    ctxCamada.strokeStyle = cor;
  }
}

canvas.addEventListener('pointerdown', (e) => {

  if (canvas.style.display === 'none') return;
  salvarEstado(); // <-- Adicione aqui, antes de começar a desenhar de fato

  const { x, y } = getCoordenadas(e);
  desenhando = true;
  canvas.setPointerCapture(e.pointerId);

  if (modoCropVisual) {
    cropInicioX = x;
    cropInicioY = y;
  } else {
    ctxCamada.beginPath();
    ctxCamada.moveTo(x, y);
    configurarPincel();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!desenhando) return;
  const { x, y } = getCoordenadas(e);

  if (modoCropVisual) {
    cropFimX = x;
    cropFimY = y;
    renderizar();
    desenharCaixaSelecao(cropInicioX, cropInicioY, cropFimX, cropFimY);
  } else {
    ctxCamada.lineTo(x, y);
    ctxCamada.stroke();
    renderizar();
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!desenhando) return;
  desenhando = false;

  if (modoCropVisual) {
    const x = Math.min(cropInicioX, cropFimX);
    const y = Math.min(cropInicioY, cropFimY);
    const w = Math.abs(cropFimX - cropInicioX);
    const h = Math.abs(cropFimY - cropInicioY);

    document.getElementById('crop-x').value = Math.round(x);
    document.getElementById('crop-y').value = Math.round(y);
    document.getElementById('crop-w').value = Math.round(w);
    document.getElementById('crop-h').value = Math.round(h);

    if (w > 5 && h > 5) {
      document.getElementById('btn-confirmar-crop').style.display = 'block';
    }
  }
});

canvas.addEventListener('pointerleave', () => { desenhando = false; });

document.getElementById('btn-pincel').addEventListener('click', () => {
  ferramentaAtual = 'pincel';
  canvas.className = 'modo-desenho';
  document.getElementById('btn-pincel').classList.add('ativo');
  document.getElementById('btn-borracha').classList.remove('ativo');
});

document.getElementById('btn-borracha').addEventListener('click', () => {
  ferramentaAtual = 'borracha';
  canvas.className = 'modo-borracha';
  document.getElementById('btn-borracha').classList.add('ativo');
  document.getElementById('btn-pincel').classList.remove('ativo');
});

document.getElementById('btn-limpar-desenho').addEventListener('click', () => {
  salvarEstado();
  ctxCamada.clearRect(0, 0, camada.width, camada.height);
  renderizar();
});

['espessura', 'opacidade'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    document.getElementById('val-' + id).textContent = document.getElementById(id).value;
  });
});

// ============================================================
// REDIMENSIONAR E RECORTAR
// ============================================================

document.getElementById('btn-aplicar-resize').addEventListener('click', () => {
  salvarEstado();
  if (canvas.style.display === 'none') return;

  const novaLargura = parseInt(document.getElementById('resize-w').value);
  const novaAltura = parseInt(document.getElementById('resize-h').value);

  if (isNaN(novaLargura) || isNaN(novaAltura) || novaLargura <= 0 || novaAltura <= 0) {
    alert("Por favor, insira valores válidos maiores que zero.");
    return;
  }

  const tempCamada = document.createElement('canvas');
  tempCamada.width = novaLargura;
  tempCamada.height = novaAltura;
  const ctxTemp = tempCamada.getContext('2d');
  ctxTemp.drawImage(camada, 0, 0, camada.width, camada.height, 0, 0, novaLargura, novaAltura);

  canvas.width = novaLargura;
  canvas.height = novaAltura;
  camada.width = novaLargura;
  camada.height = novaAltura;

  ctxCamada.drawImage(tempCamada, 0, 0);

  document.getElementById('crop-w').value = novaLargura;
  document.getElementById('crop-h').value = novaAltura;

  renderizar();
});

function desenharCaixaSelecao(x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.clearRect(x, y, w, h);
  ctx.drawImage(img, x, y, w, h, x, y, w, h);
  ctx.drawImage(camada, x, y, w, h, x, y, w, h);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

document.getElementById('btn-modo-crop').addEventListener('click', () => {
  modoCropVisual = !modoCropVisual;

  if (modoCropVisual) {
    canvas.className = 'modo-crop';
    document.getElementById('btn-modo-crop').classList.add('ativo');
    document.getElementById('btn-modo-crop').textContent = '❌ Cancelar Seleção';
  } else {
    canvas.className = '';
    document.getElementById('btn-modo-crop').classList.remove('ativo');
    document.getElementById('btn-modo-crop').textContent = '🔍 Selecionar Área';
    document.getElementById('btn-confirmar-crop').style.display = 'none';
    renderizar();
  }
});

function executarCrop() {
  salvarEstado();
  const x = parseInt(document.getElementById('crop-x').value);
  const y = parseInt(document.getElementById('crop-y').value);
  const w = parseInt(document.getElementById('crop-w').value);
  const h = parseInt(document.getElementById('crop-h').value);

  if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h) || w <= 5 || h <= 5) return;

  const tempCanvasImg = document.createElement('canvas');
  tempCanvasImg.width = w;
  tempCanvasImg.height = h;
  const ctxTempImg = tempCanvasImg.getContext('2d');
  ctxTempImg.drawImage(img, x, y, w, h, 0, 0, w, h);

  const tempCanvasDesenho = document.createElement('canvas');
  tempCanvasDesenho.width = w;
  tempCanvasDesenho.height = h;
  const ctxTempDesenho = tempCanvasDesenho.getContext('2d');
  ctxTempDesenho.drawImage(camada, x, y, w, h, 0, 0, w, h);

  // Criamos uma nova referência e deixamos a função img.onload principal tratar o resto
  img = new Image();
  img.src = tempCanvasImg.toDataURL();

  img.onload = () => {
    canvas.width = w;
    canvas.height = h;
    camada.width = w;
    camada.height = h;

    ctxCamada.clearRect(0, 0, w, h);
    ctxCamada.drawImage(tempCanvasDesenho, 0, 0);

    document.getElementById('resize-w').value = w;
    document.getElementById('resize-h').value = h;
    document.getElementById('crop-x').value = 0;
    document.getElementById('crop-y').value = 0;
    document.getElementById('crop-w').value = w;
    document.getElementById('crop-h').value = h;

    modoCropVisual = false;
    canvas.className = '';
    document.getElementById('btn-modo-crop').classList.remove('ativo');
    document.getElementById('btn-modo-crop').textContent = '🔍 Selecionar Área';
    document.getElementById('btn-confirmar-crop').style.display = 'none';

    renderizar();
  };
}

document.getElementById('btn-confirmar-crop').addEventListener('click', executarCrop);
document.getElementById('btn-aplicar-crop').addEventListener('click', executarCrop);

document.querySelectorAll('.aba').forEach(btn => {
  btn.addEventListener('click', () => {
    if (modoCropVisual) document.getElementById('btn-modo-crop').click();
  });
});

// ============================================================
// ROTAÇÃO E ESPELHAMENTO (FLIP)
// ============================================================

// --- Função Auxiliar para Transformar Imagem e Camada ---
function transformarImagem(tipo) {
  salvarEstado();
  if (canvas.style.display === 'none') return;

  // Define as novas dimensões baseadas na operação
  const novaLargura = (tipo === 'gira90') ? canvas.height : canvas.width;
  const novaAltura = (tipo === 'gira90') ? canvas.width : canvas.height;

  // 1. Cria canvas temporário para a IMAGEM BASE
  const tempCanvasImg = document.createElement('canvas');
  tempCanvasImg.width = novaLargura;
  tempCanvasImg.height = novaAltura;
  const ctxTempImg = tempCanvasImg.getContext('2d');

  // 2. Cria canvas temporário para a CAMADA DE DESENHO
  const tempCanvasDesenho = document.createElement('canvas');
  tempCanvasDesenho.width = novaLargura;
  tempCanvasDesenho.height = novaAltura;
  const ctxTempDesenho = tempCanvasDesenho.getContext('2d');

  // Configura as transformações matemáticas nos dois contextos temporários
  [ctxTempImg, ctxTempDesenho].forEach(contexto => {
    if (tipo === 'gira90') {
      contexto.translate(novaLargura, 0);
      contexto.rotate(90 * Math.PI / 180);
    } else if (tipo === 'flipH') {
      contexto.translate(novaLargura, 0);
      contexto.scale(-1, 1);
    } else if (tipo === 'flipV') {
      contexto.translate(0, novaAltura);
      contexto.scale(1, -1);
    }
  });

  // Desenha o estado atual nos canvas temporários aplicando a transformação
  ctxTempImg.drawImage(img, 0, 0);
  ctxTempDesenho.drawImage(camada, 0, 0);

  // 3. Atualiza a imagem base com o resultado transformado
  img = new Image();
  img.src = tempCanvasImg.toDataURL();

  img.onload = () => {
    // Redefine os tamanhos reais do projeto
    canvas.width = novaLargura;
    canvas.height = novaAltura;
    camada.width = novaLargura;
    camada.height = novaAltura;

    // Coloca o desenho transformado de volta na camada limpa
    ctxCamada.clearRect(0, 0, novaLargura, novaAltura);
    ctxCamada.drawImage(tempCanvasDesenho, 0, 0);

    // Atualiza os inputs numéricos na barra lateral
    document.getElementById('resize-w').value = novaLargura;
    document.getElementById('resize-h').value = novaAltura;
    document.getElementById('crop-w').value = novaLargura;
    document.getElementById('crop-h').value = novaAltura;

    // Renderiza a tela final
    renderizar();
  };
}

// --- Ouvintes de Eventos para os Botões ---
document.getElementById('btn-gira-90').addEventListener('click', () => transformarImagem('gira90'));
document.getElementById('btn-flip-h').addEventListener('click', () => transformarImagem('flipH'));
document.getElementById('btn-flip-v').addEventListener('click', () => transformarImagem('flipV'));

// ============================================================
// LÓGICA DE UNDO E REDO
// ============================================================
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');

function aplicarEstado(estado, destinoHistorico) {
  // Salva o estado oposto atual para poder fazer o caminho reverso
  destinoHistorico.push({
    imgSrc: img.src,
    desenhoSrc: camada.toDataURL(),
    width: canvas.width,
    height: canvas.height
  });

  // Restaura as dimensões
  canvas.width = estado.width;
  canvas.height = estado.height;
  camada.width = estado.width;
  camada.height = estado.height;

  // Atualiza os inputs laterais
  document.getElementById('resize-w').value = estado.width;
  document.getElementById('resize-h').value = estado.height;
  document.getElementById('crop-w').value = estado.width;
  document.getElementById('crop-h').value = estado.height;

  // Carrega o desenho de volta
  const imgDesenho = new Image();
  imgDesenho.src = estado.desenhoSrc;
  imgDesenho.onload = () => {
    ctxCamada.clearRect(0, 0, camada.width, camada.height);
    ctxCamada.drawImage(imgDesenho, 0, 0);

    // Carrega a imagem base de volta
    img = new Image();
    img.src = estado.imgSrc;
    img.onload = () => {
      renderizar();
    };
  };
}

btnUndo.addEventListener('click', () => {
  if (historicoUndo.length === 0) return;
  const estadoAnterior = historicoUndo.pop();
  aplicarEstado(estadoAnterior, historicoRedo);
});

btnRedo.addEventListener('click', () => {
  if (historicoRedo.length === 0) return;
  const proximoEstado = historicoRedo.pop();
  aplicarEstado(proximoEstado, historicoUndo);
});

// --- Adicionando suporte aos atalhos universais no seu leitor de keydown existente ---
// Encontre o seu 'window.addEventListener('keydown', ...)' e adicione estes dois 'case' no seu 'switch(tecla)':

// ============================================================
// AVISO ANTES DE RECARREGAR A PÁGINA (ANTI-PERDA DE DADOS)
// ============================================================
window.addEventListener('beforeunload', (e) => {
  if (canvas && canvas.style.display !== 'none') {
    e.preventDefault();
    e.returnValue = '';
  }
}); // <-- Fecha corretamente o beforeunload aqui!

// ============================================================
// ANIMAÇÃO DE CARREGAMENTO ORIGINAL PORTART AO VOLTAR AO INÍCIO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const btnVoltar = document.getElementById('btnVoltarInicio');
  const globalLoader = document.getElementById('globalPageLoader');

  if (btnVoltar && globalLoader) {
    btnVoltar.addEventListener('click', (e) => {
      e.preventDefault(); // Evita o redirecionamento instantâneo

      // Ativa o loader adicionando a classe 'show' idêntica à do login
      globalLoader.classList.add('show'); 

      // Segura por 3 segundos para a animação do pincel e barra rodarem lindamente
      setTimeout(() => {
        window.location.href = "../TelaInicio/index.html";
      }, 3000); 
    });
  }
});