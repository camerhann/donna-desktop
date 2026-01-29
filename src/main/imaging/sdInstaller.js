/**
 * Donna Desktop - Stable Diffusion Installer Helper
 * Helps users set up local Stable Diffusion (ComfyUI or Automatic1111)
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SD_DIR = path.join(os.homedir(), '.donna-desktop', 'stable-diffusion');
const COMFYUI_DIR = path.join(SD_DIR, 'ComfyUI');
const MODELS_DIR = path.join(SD_DIR, 'models');

/**
 * Check system requirements
 */
async function checkRequirements() {
  const requirements = {
    python: false,
    pythonVersion: null,
    git: false,
    gpu: null,
    vram: null,
    diskSpace: null
  };

  // Check Python
  try {
    const pythonVersion = await execPromise('python3 --version');
    requirements.python = true;
    requirements.pythonVersion = pythonVersion.trim();
  } catch {
    try {
      const pythonVersion = await execPromise('python --version');
      requirements.python = true;
      requirements.pythonVersion = pythonVersion.trim();
    } catch {
      requirements.python = false;
    }
  }

  // Check Git
  try {
    await execPromise('git --version');
    requirements.git = true;
  } catch {
    requirements.git = false;
  }

  // Check GPU (macOS)
  if (process.platform === 'darwin') {
    try {
      const gpuInfo = await execPromise('system_profiler SPDisplaysDataType');
      if (gpuInfo.includes('Apple M')) {
        requirements.gpu = 'apple-silicon';
        // M1/M2/M3 chips share unified memory
        const memInfo = await execPromise('sysctl hw.memsize');
        const totalMem = parseInt(memInfo.split(':')[1].trim()) / (1024 * 1024 * 1024);
        requirements.vram = `${Math.round(totalMem)}GB unified`;
      } else if (gpuInfo.includes('AMD') || gpuInfo.includes('NVIDIA')) {
        requirements.gpu = 'discrete';
      }
    } catch {
      requirements.gpu = 'unknown';
    }
  }

  // Check disk space
  try {
    const dfOutput = await execPromise(`df -h "${os.homedir()}" | tail -1`);
    const parts = dfOutput.trim().split(/\s+/);
    requirements.diskSpace = parts[3]; // Available space
  } catch {
    requirements.diskSpace = 'unknown';
  }

  return requirements;
}

/**
 * Install ComfyUI
 */
async function installComfyUI(onProgress) {
  const steps = [
    { name: 'Creating directories', weight: 5 },
    { name: 'Cloning ComfyUI', weight: 20 },
    { name: 'Creating virtual environment', weight: 10 },
    { name: 'Installing dependencies', weight: 40 },
    { name: 'Downloading base model', weight: 25 }
  ];

  let currentStep = 0;
  const report = (message) => {
    if (onProgress) {
      const progress = steps.slice(0, currentStep).reduce((a, s) => a + s.weight, 0);
      onProgress({ step: steps[currentStep].name, message, progress });
    }
  };

  try {
    // Create directories
    report('Creating installation directory...');
    if (!fs.existsSync(SD_DIR)) {
      fs.mkdirSync(SD_DIR, { recursive: true });
    }
    currentStep++;

    // Clone ComfyUI
    report('Cloning ComfyUI repository...');
    if (!fs.existsSync(COMFYUI_DIR)) {
      await execPromise(`git clone https://github.com/comfyanonymous/ComfyUI.git "${COMFYUI_DIR}"`);
    }
    currentStep++;

    // Create virtual environment
    report('Creating Python virtual environment...');
    const venvDir = path.join(COMFYUI_DIR, 'venv');
    if (!fs.existsSync(venvDir)) {
      await execPromise(`python3 -m venv "${venvDir}"`);
    }
    currentStep++;

    // Install dependencies
    report('Installing Python dependencies (this may take a while)...');
    const pip = path.join(venvDir, 'bin', 'pip');

    // Install PyTorch for Apple Silicon
    if (process.platform === 'darwin') {
      await execPromise(`"${pip}" install --upgrade pip`);
      await execPromise(`"${pip}" install torch torchvision torchaudio`);
    }

    // Install ComfyUI requirements
    await execPromise(`"${pip}" install -r "${path.join(COMFYUI_DIR, 'requirements.txt')}"`);
    currentStep++;

    // Download a base model (SD 1.5 is smaller, good for testing)
    report('Downloading base model (SD 1.5)...');
    const modelsDir = path.join(COMFYUI_DIR, 'models', 'checkpoints');
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }

    // Note: In production, you'd download from Hugging Face
    // For now, we'll create a helper script
    const downloadScript = `
# To download SD 1.5, run:
# wget -O "${modelsDir}/v1-5-pruned-emaonly.safetensors" \\
#   "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors"

# For SDXL (larger, better quality):
# wget -O "${modelsDir}/sd_xl_base_1.0.safetensors" \\
#   "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors"
`;
    fs.writeFileSync(path.join(COMFYUI_DIR, 'download_models.sh'), downloadScript);
    currentStep++;

    return {
      success: true,
      installDir: COMFYUI_DIR,
      message: 'ComfyUI installed successfully! You need to download a model to get started.'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Start ComfyUI server
 */
function startComfyUI() {
  const venvPython = path.join(COMFYUI_DIR, 'venv', 'bin', 'python');
  const mainScript = path.join(COMFYUI_DIR, 'main.py');

  if (!fs.existsSync(venvPython) || !fs.existsSync(mainScript)) {
    throw new Error('ComfyUI is not installed');
  }

  const process = spawn(venvPython, [mainScript, '--listen', '127.0.0.1', '--port', '8188'], {
    cwd: COMFYUI_DIR,
    detached: true,
    stdio: 'ignore'
  });

  process.unref();

  return {
    pid: process.pid,
    url: 'http://127.0.0.1:8188'
  };
}

/**
 * Stop ComfyUI server
 */
async function stopComfyUI() {
  try {
    await execPromise('pkill -f "ComfyUI/main.py"');
    return { success: true };
  } catch {
    return { success: false };
  }
}

/**
 * Check if ComfyUI is running
 */
async function isComfyUIRunning() {
  try {
    const response = await fetch('http://127.0.0.1:8188/system_stats');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * List available models
 */
function listModels() {
  const models = [];
  const checkpointsDir = path.join(COMFYUI_DIR, 'models', 'checkpoints');

  if (fs.existsSync(checkpointsDir)) {
    const files = fs.readdirSync(checkpointsDir);
    for (const file of files) {
      if (file.endsWith('.safetensors') || file.endsWith('.ckpt')) {
        const stats = fs.statSync(path.join(checkpointsDir, file));
        models.push({
          name: file,
          size: Math.round(stats.size / (1024 * 1024 * 1024) * 100) / 100 + ' GB',
          path: path.join(checkpointsDir, file)
        });
      }
    }
  }

  return models;
}

/**
 * Get installation status
 */
function getInstallationStatus() {
  return {
    installed: fs.existsSync(COMFYUI_DIR),
    hasVenv: fs.existsSync(path.join(COMFYUI_DIR, 'venv')),
    models: listModels(),
    installDir: COMFYUI_DIR
  };
}

/**
 * Helper: Execute command as promise
 */
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout || stderr);
      }
    });
  });
}

module.exports = {
  checkRequirements,
  installComfyUI,
  startComfyUI,
  stopComfyUI,
  isComfyUIRunning,
  listModels,
  getInstallationStatus,
  SD_DIR,
  COMFYUI_DIR,
  MODELS_DIR
};
