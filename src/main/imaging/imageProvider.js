/**
 * Donna Desktop - Image Generation Provider System
 * Supports local Stable Diffusion and optional cloud APIs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

/**
 * Base class for image providers
 */
class ImageProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = 'base';
  }

  async generate(prompt, options = {}) {
    throw new Error('generate() must be implemented by subclass');
  }

  async isAvailable() {
    return false;
  }

  getCapabilities() {
    return {
      maxResolution: 512,
      supportedStyles: [],
      supportsNegativePrompt: false,
      supportsImg2Img: false,
      supportsInpainting: false
    };
  }
}

/**
 * Stable Diffusion via ComfyUI (Local)
 */
class ComfyUIProvider extends ImageProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'comfyui';
    this.baseUrl = config.baseUrl || 'http://127.0.0.1:8188';
    this.outputDir = config.outputDir || path.join(os.homedir(), '.donna-desktop', 'images');
  }

  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/system_stats`);
      return response.ok;
    } catch {
      return false;
    }
  }

  getCapabilities() {
    return {
      maxResolution: 2048,
      supportedStyles: ['realistic', 'anime', 'artistic', 'photographic'],
      supportsNegativePrompt: true,
      supportsImg2Img: true,
      supportsInpainting: true,
      models: ['sd-xl', 'sd-1.5', 'flux-dev', 'flux-schnell']
    };
  }

  async generate(prompt, options = {}) {
    const workflow = this.buildWorkflow(prompt, options);

    // Queue the prompt
    const queueResponse = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow })
    });

    if (!queueResponse.ok) {
      throw new Error(`ComfyUI queue failed: ${queueResponse.statusText}`);
    }

    const { prompt_id } = await queueResponse.json();

    // Poll for completion
    const result = await this.waitForCompletion(prompt_id);

    // Get the output image
    const images = await this.getOutputImages(result);

    return {
      images,
      prompt,
      provider: 'comfyui',
      model: options.model || 'sd-xl'
    };
  }

  buildWorkflow(prompt, options = {}) {
    const width = options.width || 1024;
    const height = options.height || 1024;
    const steps = options.steps || 20;
    const cfg = options.cfg || 7;
    const seed = options.seed || Math.floor(Math.random() * 1000000000);
    const negativePrompt = options.negativePrompt || 'blurry, bad quality, distorted';

    // Basic SDXL workflow
    return {
      "3": {
        "inputs": {
          "seed": seed,
          "steps": steps,
          "cfg": cfg,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 1,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        },
        "class_type": "KSampler"
      },
      "4": {
        "inputs": {
          "ckpt_name": options.model || "sd_xl_base_1.0.safetensors"
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "5": {
        "inputs": {
          "width": width,
          "height": height,
          "batch_size": options.batchSize || 1
        },
        "class_type": "EmptyLatentImage"
      },
      "6": {
        "inputs": {
          "text": prompt,
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          "text": negativePrompt,
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "8": {
        "inputs": {
          "samples": ["3", 0],
          "vae": ["4", 2]
        },
        "class_type": "VAEDecode"
      },
      "9": {
        "inputs": {
          "filename_prefix": "donna",
          "images": ["8", 0]
        },
        "class_type": "SaveImage"
      }
    };
  }

  async waitForCompletion(promptId, maxWait = 300000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const response = await fetch(`${this.baseUrl}/history/${promptId}`);
      const history = await response.json();

      if (history[promptId]?.status?.completed) {
        return history[promptId];
      }

      if (history[promptId]?.status?.status_str === 'error') {
        throw new Error('ComfyUI generation failed');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('ComfyUI generation timeout');
  }

  async getOutputImages(result) {
    const images = [];
    const outputs = result.outputs || {};

    for (const nodeId in outputs) {
      const nodeOutput = outputs[nodeId];
      if (nodeOutput.images) {
        for (const img of nodeOutput.images) {
          const response = await fetch(
            `${this.baseUrl}/view?filename=${img.filename}&subfolder=${img.subfolder || ''}&type=${img.type || 'output'}`
          );
          const buffer = await response.arrayBuffer();

          // Save to local directory
          const outputPath = path.join(this.outputDir, img.filename);
          if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
          }
          fs.writeFileSync(outputPath, Buffer.from(buffer));

          images.push({
            path: outputPath,
            filename: img.filename,
            buffer: Buffer.from(buffer)
          });
        }
      }
    }

    return images;
  }
}

/**
 * Stable Diffusion via Automatic1111 WebUI (Local)
 */
class Automatic1111Provider extends ImageProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'automatic1111';
    this.baseUrl = config.baseUrl || 'http://127.0.0.1:7860';
    this.outputDir = config.outputDir || path.join(os.homedir(), '.donna-desktop', 'images');
  }

  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/sdapi/v1/sd-models`);
      return response.ok;
    } catch {
      return false;
    }
  }

  getCapabilities() {
    return {
      maxResolution: 2048,
      supportedStyles: ['realistic', 'anime', 'artistic', 'photographic'],
      supportsNegativePrompt: true,
      supportsImg2Img: true,
      supportsInpainting: true
    };
  }

  async generate(prompt, options = {}) {
    const payload = {
      prompt: prompt,
      negative_prompt: options.negativePrompt || 'blurry, bad quality, distorted',
      steps: options.steps || 20,
      cfg_scale: options.cfg || 7,
      width: options.width || 1024,
      height: options.height || 1024,
      seed: options.seed || -1,
      sampler_name: options.sampler || 'Euler',
      batch_size: options.batchSize || 1
    };

    const response = await fetch(`${this.baseUrl}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Automatic1111 generation failed: ${response.statusText}`);
    }

    const result = await response.json();
    const images = [];

    // Save images
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    for (let i = 0; i < result.images.length; i++) {
      const base64Data = result.images[i];
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `donna_${Date.now()}_${i}.png`;
      const outputPath = path.join(this.outputDir, filename);

      fs.writeFileSync(outputPath, buffer);

      images.push({
        path: outputPath,
        filename,
        buffer,
        base64: base64Data
      });
    }

    return {
      images,
      prompt,
      provider: 'automatic1111',
      info: result.info
    };
  }

  async img2img(prompt, inputImage, options = {}) {
    const imageBase64 = typeof inputImage === 'string'
      ? inputImage
      : inputImage.toString('base64');

    const payload = {
      init_images: [imageBase64],
      prompt: prompt,
      negative_prompt: options.negativePrompt || '',
      steps: options.steps || 20,
      cfg_scale: options.cfg || 7,
      denoising_strength: options.denoise || 0.75,
      width: options.width || 1024,
      height: options.height || 1024
    };

    const response = await fetch(`${this.baseUrl}/sdapi/v1/img2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Automatic1111 img2img failed: ${response.statusText}`);
    }

    const result = await response.json();
    // Process images same as txt2img...
    return result;
  }
}

/**
 * DALL-E Provider (OpenAI)
 */
class DallEProvider extends ImageProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'dalle';
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || 'dall-e-3';
  }

  async isAvailable() {
    return !!this.apiKey;
  }

  getCapabilities() {
    return {
      maxResolution: 1792,
      supportedStyles: ['vivid', 'natural'],
      supportsNegativePrompt: false,
      supportsImg2Img: false,
      supportsInpainting: true
    };
  }

  async generate(prompt, options = {}) {
    const size = this.getSize(options.width, options.height);

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        n: options.count || 1,
        size: size,
        quality: options.quality || 'standard',
        style: options.style || 'vivid',
        response_format: 'b64_json'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`DALL-E error: ${error.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const images = [];
    const outputDir = path.join(os.homedir(), '.donna-desktop', 'images');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (let i = 0; i < result.data.length; i++) {
      const buffer = Buffer.from(result.data[i].b64_json, 'base64');
      const filename = `dalle_${Date.now()}_${i}.png`;
      const outputPath = path.join(outputDir, filename);

      fs.writeFileSync(outputPath, buffer);

      images.push({
        path: outputPath,
        filename,
        buffer,
        revisedPrompt: result.data[i].revised_prompt
      });
    }

    return {
      images,
      prompt,
      provider: 'dalle',
      model: this.model
    };
  }

  getSize(width, height) {
    // DALL-E 3 supports specific sizes
    if (width >= 1792 || height >= 1792) return '1792x1024';
    if (width > 1024 || height > 1024) return '1024x1792';
    return '1024x1024';
  }
}

/**
 * Flux Provider (via Replicate or fal.ai)
 */
class FluxProvider extends ImageProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'flux';
    this.apiKey = config.apiKey || process.env.REPLICATE_API_KEY;
    this.model = config.model || 'flux-schnell'; // or 'flux-dev'
  }

  async isAvailable() {
    return !!this.apiKey;
  }

  getCapabilities() {
    return {
      maxResolution: 1440,
      supportedStyles: ['realistic', 'artistic'],
      supportsNegativePrompt: true,
      supportsImg2Img: true,
      supportsInpainting: false
    };
  }

  async generate(prompt, options = {}) {
    const modelVersion = this.model === 'flux-dev'
      ? 'black-forest-labs/flux-dev'
      : 'black-forest-labs/flux-schnell';

    // Start prediction
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${this.apiKey}`
      },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          prompt: prompt,
          width: options.width || 1024,
          height: options.height || 1024,
          num_outputs: options.count || 1,
          guidance: options.cfg || 3.5,
          num_inference_steps: options.steps || (this.model === 'flux-schnell' ? 4 : 28)
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Flux error: ${error.detail || response.statusText}`);
    }

    const prediction = await response.json();

    // Poll for completion
    const result = await this.waitForPrediction(prediction.id);

    // Download images
    const images = [];
    const outputDir = path.join(os.homedir(), '.donna-desktop', 'images');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (let i = 0; i < result.output.length; i++) {
      const imageUrl = result.output[i];
      const imageResponse = await fetch(imageUrl);
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const filename = `flux_${Date.now()}_${i}.png`;
      const outputPath = path.join(outputDir, filename);

      fs.writeFileSync(outputPath, buffer);

      images.push({
        path: outputPath,
        filename,
        buffer
      });
    }

    return {
      images,
      prompt,
      provider: 'flux',
      model: this.model
    };
  }

  async waitForPrediction(id, maxWait = 300000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: { 'Authorization': `Token ${this.apiKey}` }
      });

      const prediction = await response.json();

      if (prediction.status === 'succeeded') {
        return prediction;
      }

      if (prediction.status === 'failed') {
        throw new Error(`Flux generation failed: ${prediction.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Flux generation timeout');
  }
}

/**
 * Image Manager - Handles multiple providers
 */
class ImageManager {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = null;
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
    if (!this.defaultProvider) {
      this.defaultProvider = name;
    }
  }

  setDefaultProvider(name) {
    if (this.providers.has(name)) {
      this.defaultProvider = name;
    }
  }

  getProvider(name) {
    return this.providers.get(name || this.defaultProvider);
  }

  async listProviders() {
    const result = [];
    for (const [name, provider] of this.providers) {
      result.push({
        name,
        type: provider.name,
        available: await provider.isAvailable(),
        capabilities: provider.getCapabilities()
      });
    }
    return result;
  }

  async generate(prompt, options = {}) {
    const provider = this.getProvider(options.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${options.provider || this.defaultProvider}`);
    }

    if (!await provider.isAvailable()) {
      throw new Error(`Provider ${provider.name} is not available`);
    }

    return provider.generate(prompt, options);
  }
}

/**
 * Create configured image manager
 */
function createImageManager(config = {}) {
  const manager = new ImageManager();

  // Register ComfyUI (local)
  manager.registerProvider('comfyui', new ComfyUIProvider({
    baseUrl: config.comfyui?.baseUrl
  }));

  // Register Automatic1111 (local)
  manager.registerProvider('automatic1111', new Automatic1111Provider({
    baseUrl: config.automatic1111?.baseUrl
  }));

  // Register DALL-E (optional)
  if (config.dalle?.apiKey || process.env.OPENAI_API_KEY) {
    manager.registerProvider('dalle', new DallEProvider({
      apiKey: config.dalle?.apiKey,
      model: config.dalle?.model
    }));
  }

  // Register Flux (optional)
  if (config.flux?.apiKey || process.env.REPLICATE_API_KEY) {
    manager.registerProvider('flux', new FluxProvider({
      apiKey: config.flux?.apiKey,
      model: config.flux?.model
    }));
  }

  // Set default provider
  if (config.defaultProvider && manager.providers.has(config.defaultProvider)) {
    manager.setDefaultProvider(config.defaultProvider);
  }

  return manager;
}

module.exports = {
  ImageProvider,
  ComfyUIProvider,
  Automatic1111Provider,
  DallEProvider,
  FluxProvider,
  ImageManager,
  createImageManager
};
