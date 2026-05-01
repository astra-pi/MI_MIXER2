const tituloCancion = document.querySelector('.info-cancion h1');
const nombreArtista = document.querySelector('.info-cancion p');
const progreso = document.getElementById('progreso');
const cancion = document.getElementById('cancion');
const videoFondo = document.getElementById('video-fondo');

const inconoControl = document.getElementById('iconoControl');
const botonReproducirPausar = document.querySelector('.boton-reproducir-pausar');
const botonAtras = document.querySelector('.atras');
const botonAdelante = document.querySelector('.adelante');
const botonFavorito = document.querySelector('.favorito');
const botonLista = document.querySelector('.lista');

const tiempoActualDOM = document.getElementById('tiempo-actual');
const tiempoTotalDOM = document.getElementById('tiempo-total');
const playlistPanel = document.getElementById('playlist-panel');
const playlistContainer = document.getElementById('playlist-container');

let canciones = [];
let indiceCancionActual = 0;

let fondoPersonalizadoURL = 'img/BackGround.mp4';
let esFondoPersonalizadoVideo = true;
let currentFondoAplicado = 'img/BackGround.mp4';

// Rastreador estricto para no reiniciar la música por accidente
let currentAudioSrc = '';

let audioCtx, analyser, dataArray;
let picosArray = [];
let smoothedMagnitudes = [];
let isAudioSetup = false;
let isDragging = false;

const canvasOndas = document.getElementById('ondas-lineal');
const ctxOndas = canvasOndas.getContext('2d');

const colores = [
    {r: 120, g: 200, b: 255}, {r: 70,  g: 130, b: 255},
    {r: 150, g: 90,  b: 220}, {r: 255, g: 220, b: 120},
    {r: 255, g: 180, b: 90},  {r: 255, g: 100, b: 100}
];

// Temporizador para evitar reconstruir el DOM repetidamente y causar lag
let renderPlaylistTimer;
function solicitarRenderizadoPlaylist() {
    clearTimeout(renderPlaylistTimer);
    renderPlaylistTimer = setTimeout(() => {
        actualizarPlaylist();
    }, 150);
}

// ==========================================
// LÓGICA DEL TOCADISCOS INTEGRADA
// ==========================================
const SG_COLOR_OFF = '#4d4d4d';
const SG_COLOR_ON = '#ff0000';

class Tocadiscos {
    constructor() {
        this.SPIN_STATE = 0;
        this.NEEDLE_STATE = 0;
        this.POWER_ON = false;
        this.START_DEG = 22;
        this.END_DEG = 48;
        this.NEEDLE_SWINGDOW = this.END_DEG - this.START_DEG;
        this.volume = 40;
        this.needleDrag = false;
        this.recordScratch = false;
        
        this.actors = {};
        this.tweens = {};
        this.draggables = {};

        this.actors.record = document.querySelector('#Record');
        this.actors.vinyl = document.querySelector('#vinyl');
        this.actors.recordPlateLight = document.querySelector('#play-state-ring');
        this.actors.startButton = document.querySelector('#StartButton');
        this.actors.startButtonLight = document.querySelector('#on-light');
        
        this.actors.powerCenterOn = document.querySelector('#power-center-on');
        this.actors.strobeReflection = document.querySelector('#strobe-reflection');

        this.actors.volumeKnob = document.querySelector('#volume-knob');
        this.actors.volumeKnobLight = document.querySelector('#knob-light');
        this.actors.volumeTrack = document.querySelector('#volume-track');
        this.actors.volumeLightLevel = document.querySelector('#light-level');

        this.actors.needleArm = document.querySelector('#needle-arm');
        this.actors.needleFolcrum = document.querySelector('#needle-folcrum-light');
        this.actors.needleHeadLights = document.querySelectorAll('.needle-head-lights');
        this.actors.vinylSurface = document.querySelector('.vinyl-record');
    }

    init() {
        TweenMax.set(this.actors.powerCenterOn, {opacity: 0});
        TweenMax.set(this.actors.strobeReflection, {opacity: 0});
        TweenMax.set(this.actors.startButtonLight, {fill: SG_COLOR_OFF});
        TweenMax.set(this.actors.volumeKnob, {y: '+=' + (this.actors.volumeTrack.getBBox().height / 2) });
        TweenMax.set(this.actors.volumeKnobLight, {stroke: SG_COLOR_OFF });
        TweenMax.set(this.actors.volumeLightLevel, {scaleY: 0.0, transformOrigin: '50% 100%' });
        TweenMax.set(this.actors.recordPlateLight, {autoAlpha: 0});
        TweenMax.set([this.actors.vinyl, '#recordplate'], {svgOrigin:'262.818 218.245'});
        TweenMax.set(this.actors.needleArm, {svgOrigin:'485.222 106.585'});

        this._setupTweens();
        this._setupListeners();
        this.setVolume(this.volume);
    }

    encender() {
        if (!this.POWER_ON) {
            this.POWER_ON = true;
            TweenMax.to(this.actors.powerCenterOn, 0.3, {opacity: 1});
            TweenMax.to(this.actors.strobeReflection, 0.5, {opacity: 0.78});
            TweenMax.to(['#vinyl', '#shine-layer'], 0.5, {opacity: 1});
        }
    }

    _setupTweens() {
        var self = this;
        this.tweens.vinyl = new TimelineMax({repeat:-1, paused: true});
        this.tweens.vinyl.to([this.actors.vinyl, '#recordplate'],3,{svgOrigin: '262.818 218.245', rotation: '+=360', ease: Linear.easeNone });

        this.tweens.volumeKnob = TweenMax.fromTo(this.actors.volumeKnob, 1,
                                                 {y: (this.actors.volumeTrack.getBBox().height / 2)},
                                                 {y: -1*(this.actors.volumeTrack.getBBox().height / 2), ease: Linear.easeNone, paused: true });
        this.tweens.volumeLightLevel = TweenMax.fromTo(this.actors.volumeLightLevel, 1,
                                                       {scaleY: 0.0, transformOrigin: '50% 100%' }, {scaleY: 1, paused: true, transformOrigin: '50% 100%', ease: Linear.easeNone });

        this.draggables.volumeKnob = Draggable.create(this.actors.volumeKnob, {
            type: 'y',
            bounds: {minY: this.actors.volumeTrack.getBBox().height / 2, maxY: -1*(this.actors.volumeTrack.getBBox().height / 2)},
            onDrag: function() { self._setVolFromDrag(this); },
            onThrowUpdate: function() { self._setVolFromDrag(this); },
            throwProps: true, overshootTolerance: 0
        });

        this.draggables.needleArm = Draggable.create(this.actors.needleArm, {
            throwProps: true, type: 'rotation',      
            bounds: {minRotation: 0, maxRotation: this.END_DEG},
            onDragStart: function(){
                self.needleDrag = true;
                if(self.SPIN_STATE == 1 && self.NEEDLE_STATE == 1){ cancion.pause(); }
            },
            onDrag: function(){ self._needleUpdate(this, self); },
            onDragEnd: function(){
                if(this.rotation >= self.START_DEG && this.rotation <= self.END_DEG && cancion.duration) {
                    let pos = (this.rotation - self.START_DEG) / self.NEEDLE_SWINGDOW;
                    cancion.currentTime = pos * cancion.duration;
                    if(self.SPIN_STATE == 1) cancion.play();
                }
                self.needleDrag = false;
            }
        });

        this.draggables.vinyl = Draggable.create(this.actors.vinyl, {      
            type: 'rotation',
            onPress: () => this._pauseRecordScratch(),
            onDragStart: () => this._pauseRecordScratch(),
            onDrag: function(){ TweenMax.set('#recordplate', {rotation: this.rotation, svgOrigin: '262.818 218.245'}); },
            onRelease: () => { if(this.draggables.vinyl[0].tween) this.draggables.vinyl[0].tween.kill(); this._resumeRecordScratch(); }
        });
    }

    _setVolFromDrag(dragScope) {
        let range = dragScope.minY - dragScope.maxY, yval = dragScope.y - dragScope.maxY;
        this.setVolume(yval * 100 / range);
    }

    _setupListeners() {
        const togglePlay = (e) => {
            if (e && e.type === 'touchstart') e.preventDefault();
            if(!this.POWER_ON) return;
            if(cancion.paused) reproducirCancion();
            else pausarCancion();
        };

        this.actors.startButton.addEventListener('click', togglePlay);
        this.actors.startButton.addEventListener('touchstart', togglePlay, {passive: false});

        const pauseScratch = (e) => { if(cancion.src) this._pauseRecordScratch(); };
        const resumeScratch = () => this._resumeRecordScratch();
        
        this.actors.record.addEventListener('pointerdown', pauseScratch);
        this.actors.record.addEventListener('touchstart', pauseScratch, {passive: true});
        if (this.actors.vinylSurface) {
            this.actors.vinylSurface.addEventListener('pointerdown', pauseScratch);
            this.actors.vinylSurface.addEventListener('touchstart', pauseScratch, {passive: true});
        }
        document.addEventListener('pointerup', resumeScratch);
        document.addEventListener('touchend', resumeScratch);
        document.addEventListener('pointercancel', resumeScratch);
        document.addEventListener('touchcancel', resumeScratch);
    }

    _pauseRecordScratch() {
        if (this.recordScratch) return;
        this.recordScratch = true;
        this.tweens.vinyl.pause();
        cancion.pause();
    }

    _resumeRecordScratch() {
        if (!this.recordScratch) return;
        this.recordScratch = false;
        if (this.SPIN_STATE === 1) {
            this.tweens.vinyl.resume();
            if (this.NEEDLE_STATE === 1) cancion.play();
        }
    }

    _needleUpdate(tween, me) {
        var rotation = tween.target._gsTransform.rotation;
        var lights = [me.actors.needleFolcrum, me.actors.needleHeadLights];
        if(rotation >= me.START_DEG && rotation <= me.END_DEG) {
            TweenMax.to(lights, 0.3, {fill: SG_COLOR_ON});
            me.NEEDLE_STATE = 1;
        } else {
            TweenMax.to(lights, 0.3, {fill: SG_COLOR_OFF});
            me.NEEDLE_STATE = 0;
        }
    }

    playTurntable() {
        if(!this.POWER_ON) return;
        this.SPIN_STATE = 1;
        this.tweens.vinyl.resume();
        TweenMax.set(this.actors.startButtonLight, {fill: SG_COLOR_ON});
        TweenMax.to(this.actors.recordPlateLight, 1.4, {autoAlpha: 1, delay: 0.25});
        
        if (!this.needleDrag && !this.recordScratch) {
            let percent = cancion.duration ? (cancion.currentTime / cancion.duration) * 100 : 0;
            if (isNaN(percent)) percent = 0;
            let targetRot = this.START_DEG + this.NEEDLE_SWINGDOW * (percent / 100);
            this._moveNeedleTo(targetRot);
        }
    }

    pauseTurntable() {
        this.SPIN_STATE = 0;
        this.tweens.vinyl.pause();
        TweenMax.set(this.actors.startButtonLight, {fill: SG_COLOR_OFF});
        TweenMax.to(this.actors.recordPlateLight, 2, {autoAlpha: 0});
    }

    setVolume(val) {
        if(val < 0) val = 0;
        if(val > 100) val = 100;
        this.volume = val;
        this.tweens.volumeKnob.progress(this.volume/100);
        this.tweens.volumeLightLevel.progress(this.volume/100);
        cancion.volume = this.volume / 100;
        TweenMax.set(this.actors.volumeKnobLight, {stroke: this.volume > 0 ? SG_COLOR_ON : SG_COLOR_OFF });
    }

    _moveNeedleTo(val) {
        if(val < 0) val = 0;
        if(val > 100) val = 100;
        TweenMax.to(this.actors.needleArm, 1, {
            rotation:val, svgOrigin: '485.222 106.585', ease: Linear.easeNone,
            onUpdate: this._needleUpdate, onUpdateParams:["{self}", this],
            overwrite: "auto"
        });
    }

    loadNeedle() {
        this._moveNeedleTo(this.START_DEG);
    }

    hangUpNeedle() {
        this._moveNeedleTo(0);
    }

    syncProgress(percent) {
        if(this.NEEDLE_STATE == 1 && this.SPIN_STATE == 1 && !this.needleDrag && !this.recordScratch) {
            if(percent >= 100) this.hangUpNeedle();
            else this._moveNeedleTo(this.START_DEG + this.NEEDLE_SWINGDOW*(percent/100));
        }
    }
}
const tocadiscos = new Tocadiscos();
tocadiscos.init();

// ==========================================
// LÓGICA DE REPRODUCCIÓN NORMAL
// ==========================================

new Sortable(playlistContainer, {
    handle: '.handle',
    animation: 150,
    onEnd: function (evt) {
        const item = canciones.splice(evt.oldIndex, 1)[0];
        canciones.splice(evt.newIndex, 0, item);
        if (indiceCancionActual === evt.oldIndex) indiceCancionActual = evt.newIndex;
        else if (evt.oldIndex < indiceCancionActual && evt.newIndex >= indiceCancionActual) indiceCancionActual--;
        else if (evt.oldIndex > indiceCancionActual && evt.newIndex <= indiceCancionActual) indiceCancionActual++;
    }
});

function playMedia(media) {
    if (!media || !media.paused) return;
    const p = media.play();
    if (p !== undefined) p.catch(() => {});
}

function actualizarEstadoFondo() {
    const actual = canciones[indiceCancionActual];
    const esVideoMusical = actual && actual.tipo.startsWith('video/') && currentFondoAplicado === actual.fuente;
    if (esVideoMusical) {
        if (cancion.paused) videoFondo.pause();
        else playMedia(videoFondo);
    } else {
        if (videoFondo.style.display !== 'none') playMedia(videoFondo);
    }
}

cancion.addEventListener('play', () => {
    inconoControl.classList.replace('bi-play-fill', 'bi-pause-fill');
    botonReproducirPausar.classList.add('reproduciendo', 'pausa');
    actualizarEstadoFondo();
    tocadiscos.playTurntable();
});

cancion.addEventListener('pause', () => {
    inconoControl.classList.replace('bi-pause-fill', 'bi-play-fill');
    botonReproducirPausar.classList.remove('reproduciendo', 'pausa');
    actualizarEstadoFondo();
    tocadiscos.pauseTurntable();
});

videoFondo.addEventListener('pause', () => actualizarEstadoFondo());
videoFondo.addEventListener('ended', () => { videoFondo.currentTime = 0; playMedia(videoFondo); });
videoFondo.addEventListener('error', () => {
    const actual = canciones[indiceCancionActual];
    if (actual && actual.tipo.startsWith('video/') && currentFondoAplicado === actual.fuente) restaurarFondoBackground();
});
videoFondo.addEventListener('timeupdate', () => {
    const actual = canciones[indiceCancionActual];
    if (!(actual && actual.tipo.startsWith('video/') && currentFondoAplicado === actual.fuente) && videoFondo.currentTime >= 180) videoFondo.currentTime = 0;
});

function interpolarColor(t) {
    const total = colores.length - 1;
    const tSuave = t * t * (3 - 2 * t);
    const index = Math.floor(tSuave * total);
    const frac = (tSuave * total) - index;
    const c1 = colores[index];
    const c2 = colores[index + 1] || c1;
    const r = Math.round(c1.r + (c2.r - c1.r) * frac);
    const g = Math.round(c1.g + (c2.g - c1.g) * frac);
    const b = Math.round(c1.b + (c2.b - c1.b) * frac);
    return `rgb(${r}, ${g}, ${b})`;
}

function configurarAudio() {
    if (isAudioSetup) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0;
        const source = audioCtx.createMediaElementSource(cancion);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        smoothedMagnitudes = new Float32Array(analyser.frequencyBinCount);
        for(let i = 0; i < analyser.frequencyBinCount; i++) picosArray.push(0);
        isAudioSetup = true;
    } catch (e) { console.log("AudioContext bloqueado"); }
}

function ajustarCanvas() {
    canvasOndas.width = canvasOndas.clientWidth;
    canvasOndas.height = canvasOndas.clientHeight;
}
window.addEventListener('resize', ajustarCanvas);

function animarOndas() {
    requestAnimationFrame(animarOndas);
    ctxOndas.clearRect(0, 0, canvasOndas.width, canvasOndas.height);
    const numBarras = isAudioSetup ? analyser.frequencyBinCount : 128;
    const anchoBarra = (canvasOndas.width / numBarras) * 2;
    let x = 0;
    if (isAudioSetup) analyser.getByteFrequencyData(dataArray);
    for (let i = 0; i < numBarras; i++) {
        let alturaBarra = 2, valorNorm = 0, colorActual = '#ffffff';
        if (isAudioSetup) {
            smoothedMagnitudes[i] = 0.8 * smoothedMagnitudes[i] + 0.2 * dataArray[i];
            valorNorm = smoothedMagnitudes[i] / 255;
            alturaBarra = Math.max(Math.pow(valorNorm, 1.5) * canvasOndas.height, 2);
            alturaBarra = Math.min(alturaBarra, canvasOndas.height - 4);
            if (alturaBarra > picosArray[i]) picosArray[i] = alturaBarra;
            else { picosArray[i] -= 1.2; if(picosArray[i] < 0) picosArray[i] = 0; }
            if (valorNorm > 0.01) colorActual = interpolarColor(valorNorm);
        }
        ctxOndas.shadowBlur = (isAudioSetup && valorNorm > 0.01) ? 10 : 0;
        ctxOndas.shadowColor = colorActual;
        ctxOndas.fillStyle = colorActual;
        ctxOndas.fillRect(x, canvasOndas.height - alturaBarra, anchoBarra - 1, alturaBarra);
        if (isAudioSetup) {
            ctxOndas.shadowBlur = 0;
            ctxOndas.fillStyle = '#ffffff';
            let picoAltura = Math.min(picosArray[i] + 3, canvasOndas.height);
            ctxOndas.fillRect(x, canvasOndas.height - picoAltura, anchoBarra - 1, 3);
        }
        x += anchoBarra;
    }
}
ajustarCanvas();
animarOndas();

function aplicarFondoCorrecto() {
    const actual = canciones[indiceCancionActual];
    if (actual && actual.tipo.startsWith('video/')) {
        document.body.style.backgroundImage = 'none';
        if (currentFondoAplicado !== actual.fuente) {
            videoFondo.src = actual.fuente;
            videoFondo.load();
            currentFondoAplicado = actual.fuente;
        }
        videoFondo.style.display = 'block';
        actualizarEstadoFondo();
    } else {
        restaurarFondoBackground();
    }
}

function restaurarFondoBackground() {
    if (esFondoPersonalizadoVideo) {
        document.body.style.backgroundImage = 'none';
        if (currentFondoAplicado !== fondoPersonalizadoURL) {
            videoFondo.src = fondoPersonalizadoURL;
            videoFondo.load();
            currentFondoAplicado = fondoPersonalizadoURL;
        }
        videoFondo.style.display = 'block';
    } else {
        if (currentFondoAplicado !== fondoPersonalizadoURL) {
            videoFondo.pause();
            videoFondo.style.display = 'none';
            currentFondoAplicado = fondoPersonalizadoURL;
        }
        document.body.style.backgroundImage = `url(${fondoPersonalizadoURL})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
    }
    actualizarEstadoFondo();
}

function actualizarColorProgreso() {
    const porcentaje = (progreso.value / progreso.max) * 100 || 0;
    progreso.style.background = `linear-gradient(to right, rgba(204, 0, 0, 0.8) ${porcentaje}%, rgba(255, 255, 255, 0.2) ${porcentaje}%)`;
}

function habilitarControles() {
    if (canciones.length > 0) {
        progreso.disabled = false;
        document.querySelectorAll('.controles button').forEach(btn => btn.classList.remove('sin-musica'));
    }
}

document.getElementById('fondo-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        fondoPersonalizadoURL = URL.createObjectURL(file);
        esFondoPersonalizadoVideo = file.type.startsWith('video/');
        aplicarFondoCorrecto();
    }
});

function getFileMimeType(file) {
    if (file.type && file.type.startsWith('video/')) return file.type;
    const extVideo = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
    if (extVideo.some(ext => file.name.toLowerCase().endsWith(ext))) return 'video/mp4';
    return file.type || 'audio/mpeg';
}

document.getElementById('musica-input').addEventListener('change', async function(e){
    const fuePrimeraCarga = canciones.length === 0;
    const files = Array.from(e.target.files);
    
    for(const file of files) {
        const cancionUrl = URL.createObjectURL(file);
        const cancionObj = {
            titulo: file.name.replace(/\.[^/.]+$/, ""),
            nombre: 'sin artista', fuente: cancionUrl,
            tipo: getFileMimeType(file), img: null, duracion: '0:00'
        };

        jsmediatags.read(file, {
            onSuccess: function(tag) {
                if (tag.tags.artist) cancionObj.nombre = tag.tags.artist;
                
                // OPTIMIZACIÓN CRÍTICA: Convertir array de bytes a Blob de forma nativa en lugar de usar un bucle masivo
                if (tag.tags.picture) {
                    const { data, format } = tag.tags.picture;
                    const blob = new Blob([new Uint8Array(data)], { type: format });
                    cancionObj.img = URL.createObjectURL(blob);
                }
                
                solicitarRenderizadoPlaylist();
                if (canciones[indiceCancionActual] === cancionObj) actualizarInfoCancion();
            }
        });

        const tempAudio = new Audio(cancionUrl);
        tempAudio.addEventListener('loadedmetadata', () => {
            cancionObj.duracion = formatearTiempo(tempAudio.duration);
            solicitarRenderizadoPlaylist();
        });

        canciones.push(cancionObj);
    }

    solicitarRenderizadoPlaylist();
    habilitarControles();
    
    if (fuePrimeraCarga && canciones.length > 0) {
        indiceCancionActual = 0;
        actualizarInfoCancion();
        reproducirCancion();
    }
});

function actualizarPlaylist() {
    playlistContainer.innerHTML = '';
    canciones.forEach((c, index) => {
        const li = document.createElement('li');
        if(index === indiceCancionActual) li.classList.add('active');

        const iconoVolumen = index === indiceCancionActual ? '<i class="bi bi-volume-up-fill"></i> ' : '';

        li.innerHTML = `
            <div class="pl-thumb">${c.img ? `<img src="${c.img}">` : '<i class="bi bi-music-note-beamed"></i>'}</div>
            <div class="pl-info">
                <span class="pl-title">${iconoVolumen}${c.titulo}</span>
                <span class="pl-artist">${c.nombre}</span>
            </div>
            <span class="pl-duration">${c.duracion}</span>
            <div class="handle"><i class="bi bi-list"></i></div>
        `;

        li.onclick = (e) => {
            if (e.target.closest('.handle')) return;
            indiceCancionActual = index;
            actualizarInfoCancion();
            reproducirCancion();
        };
        playlistContainer.appendChild(li);
    });
}

function actualizarInfoCancion(){
    if (canciones.length > 0) {
        const actual = canciones[indiceCancionActual];
        tituloCancion.textContent = actual.titulo;
        nombreArtista.textContent = actual.nombre === 'sin artista' ? 'Archivo local' : actual.nombre;
        
        if (currentAudioSrc !== actual.fuente) {
            cancion.src = actual.fuente;
            currentAudioSrc = actual.fuente;
            tocadiscos.hangUpNeedle();
        }
        
        const albumCover = document.getElementById('album-cover');
        const recordDiv = document.querySelector('.vinyl-record');
        if(actual.img) {
            albumCover.src = actual.img;
            TweenMax.to('#album-cover', 0.3, {opacity: 1});
            recordDiv.classList.add('has-cover');
        } else {
            TweenMax.to('#album-cover', 0.3, {opacity: 0});
            recordDiv.classList.remove('has-cover');
        }

        solicitarRenderizadoPlaylist();
        aplicarFondoCorrecto();
        actualizarColorProgreso();

        tocadiscos.encender();
    }
}

cancion.addEventListener('loadedmetadata', () => {
    progreso.max = cancion.duration;
    tiempoTotalDOM.textContent = formatearTiempo(cancion.duration);
});

cancion.addEventListener('timeupdate', () => {
    if(!cancion.paused && !isDragging){
        progreso.value = cancion.currentTime;
        tiempoActualDOM.textContent = formatearTiempo(cancion.currentTime);
        
        if(cancion.duration) {
            let percent = (cancion.currentTime / cancion.duration) * 100;
            tocadiscos.syncProgress(percent);
        }

        const actual = canciones[indiceCancionActual];
        if (actual && actual.tipo.startsWith('video/') && currentFondoAplicado === actual.fuente) {
            const diff = videoFondo.currentTime - cancion.currentTime;
            
            if (Math.abs(diff) > 0.3) {
                if (Math.abs(diff) > 2) {
                    videoFondo.currentTime = cancion.currentTime;
                } else {
                    videoFondo.playbackRate = diff > 0 ? 0.9 : 1.1;
                }
            } else {
                if (videoFondo.playbackRate !== 1) videoFondo.playbackRate = 1;
            }
        }
        actualizarColorProgreso();
    }
});

progreso.addEventListener('input', () => {
    isDragging = true;
    cancion.currentTime = progreso.value;
    tiempoActualDOM.textContent = formatearTiempo(cancion.currentTime);
    const actual = canciones[indiceCancionActual];
    if (actual && actual.tipo.startsWith('video/') && currentFondoAplicado === actual.fuente) videoFondo.currentTime = progreso.value;
    actualizarColorProgreso();
});

progreso.addEventListener('change', () => { isDragging = false; });

botonReproducirPausar.addEventListener('click', () => {
    if(canciones.length === 0) return;
    if(cancion.paused) reproducirCancion();
    else pausarCancion();
});

function reproducirCancion(){
    if (canciones.length === 0) return;
    configurarAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    playMedia(cancion);
}

function pausarCancion(){ cancion.pause(); }

function formatearTiempo(segundos) {
    if (isNaN(segundos)) return "0:00";
    const min = Math.floor(segundos / 60);
    const sec = Math.floor(segundos % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

botonAdelante.addEventListener('click', () => {
    if(canciones.length === 0) return;
    indiceCancionActual = (indiceCancionActual + 1) % canciones.length;
    actualizarInfoCancion(); reproducirCancion();
});

botonAtras.addEventListener('click', () => {
    if(canciones.length === 0) return;
    indiceCancionActual = (indiceCancionActual - 1 + canciones.length) % canciones.length;
    actualizarInfoCancion(); reproducirCancion();
});

cancion.addEventListener('ended', () => { botonAdelante.click(); });
botonFavorito.addEventListener('click', () => botonFavorito.classList.toggle('activo'));

botonLista.addEventListener('click', () => {
    const iconoSpan = botonLista.querySelector('span');
    if (playlistPanel.style.display === 'none') {
        playlistPanel.style.display = 'block';
        botonLista.style.color = '#e67e22';
        if (iconoSpan) iconoSpan.style.backgroundColor = '#e67e22';
    } else {
        playlistPanel.style.display = 'none';
        botonLista.style.color = '';
        if (iconoSpan) iconoSpan.style.backgroundColor = 'currentColor';
    }
});

aplicarFondoCorrecto();
