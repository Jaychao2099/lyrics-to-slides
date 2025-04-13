/// <reference types="node" />
/// <reference types="electron" />

import { SettingsService } from './settings';
import { LoggerService } from './logger';
import OpenAI from 'openai';
import { AIProvider, OpenAITextModel, OpenAIImageModel, GeminiTextModel, GeminiImageModel, GrokTextModel, GrokImageModel, AnthropicModel } from '../../common/types';
import fetch from 'node-fetch';
import { GoogleGenAI, DynamicRetrievalConfigMode } from '@google/genai';

/**
 * AI服務接口
 */
export interface AIService {
  /**
   * 初始化AI服務
   * @returns 是否初始化成功
   */
  initialize(): Promise<boolean>;

  /**
   * 生成文本
   * @param prompt 提示詞
   * @returns 生成的文本
   */
  generateText(prompt: string): Promise<string>;

  /**
   * 生成圖片
   * @param prompt 提示詞
   * @returns 生成的圖片URL
   */
  generateImage(prompt: string): Promise<string>;

  /**
   * 獲取提供商名稱
   * @returns 提供商名稱
   */
  getProviderName(): AIProvider;
}

/**
 * OpenAI服務實現
 */
export class OpenAIService implements AIService {
  private client: OpenAI | null = null;
  private model: OpenAITextModel | OpenAIImageModel;

  constructor(model?: OpenAITextModel | OpenAIImageModel) {
    // 使用提供的模型或從設定中獲取
    if (model) {
      this.model = model;
    } else {
      // 嘗試獲取文字模型
      try {
        const lyricsSearchModel = SettingsService.getSetting('lyricsSearchModel');
        this.model = lyricsSearchModel.openai;
      } catch {
        // 如果無法獲取文字模型，使用圖片模型
        try {
          const imageGenerationModel = SettingsService.getSetting('imageGenerationModel');
          this.model = imageGenerationModel.openai;
        } catch {
          // 默認使用 gpt-4o
          this.model = 'gpt-4o';
        }
      }
    }
  }

  async initialize(): Promise<boolean> {
    try {
      const apiKey = SettingsService.getSetting('openaiApiKey');
      if (!apiKey) {
        throw new Error('未設定OpenAI API金鑰');
      }
      this.client = new OpenAI({
        apiKey: apiKey as string,
      });
      return true;
    } catch (error) {
      console.error('初始化OpenAI API失敗:', error);
      await LoggerService.error('初始化OpenAI API失敗', error);
      return false;
    }
  }

  async generateText(prompt: string): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('OpenAI API未初始化');
    }

    const startTime = LoggerService.apiStart('OpenAIService', 'generateText', { promptLength: prompt.length });

    try {
      const response = await this.client.chat.completions.create({
        model: this.isImageModel(this.model) ? 'gpt-4o' : this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const text = response.choices[0]?.message?.content || '';
      await LoggerService.apiSuccess('OpenAIService', 'generateText', 
        { promptLength: prompt.length }, 
        { responseLength: text.length }, 
        startTime
      );
      return text;
    } catch (error) {
      await LoggerService.apiError('OpenAIService', 'generateText', 
        { promptLength: prompt.length }, 
        error, 
        startTime
      );
      throw error;
    }
  }

  async generateImage(prompt: string): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('OpenAI API未初始化');
    }

    // 使用DALL-E模型
    const model = this.isImageModel(this.model) ? this.model : 'dall-e-3';
    const startTime = LoggerService.apiStart('OpenAIService', 'generateImage', { model, promptLength: prompt.length });

    try {
      const response = await this.client.images.generate({
        model: model as 'dall-e-3' | 'dall-e-2',
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new Error('圖片生成失敗');
      }

      await LoggerService.apiSuccess('OpenAIService', 'generateImage', 
        { model, promptLength: prompt.length }, 
        { url: '有URL' }, 
        startTime
      );
      return imageUrl;
    } catch (error) {
      await LoggerService.apiError('OpenAIService', 'generateImage', 
        { model, promptLength: prompt.length }, 
        error, 
        startTime
      );
      throw error;
    }
  }

  getProviderName(): AIProvider {
    return 'openai';
  }

  private isImageModel(model: string): boolean {
    return model === 'dall-e-2' || model === 'dall-e-3';
  }
}

/**
 * Google Gemini服務實現 (使用 @google/genai SDK)
 */
export class GeminiService implements AIService {
  private genAI: GoogleGenAI | null = null;
  private model: GeminiTextModel | GeminiImageModel;

  constructor(model?: GeminiTextModel | GeminiImageModel) {
    // 使用提供的模型或從設定中獲取
    if (model) {
      this.model = model;
    } else {
      // 嘗試獲取文字模型
      try {
        const lyricsSearchModel = SettingsService.getSetting('lyricsSearchModel');
        this.model = lyricsSearchModel.gemini;
      } catch {
        // 如果無法獲取文字模型，使用圖片模型
        try {
          const imageGenerationModel = SettingsService.getSetting('imageGenerationModel');
          this.model = imageGenerationModel.gemini;
        } catch {
          // 默認使用 gemini-2.0-flash
          this.model = 'gemini-2.0-flash';
        }
      }
    }
  }

  async initialize(): Promise<boolean> {
    try {
      const apiKey = SettingsService.getSetting('geminiApiKey');
      if (!apiKey) {
        throw new Error('未設定Gemini API金鑰');
      }
      // 使用新的 SDK 初始化方式
      this.genAI = new GoogleGenAI({ apiKey });
      await LoggerService.info(`Gemini SDK 初始化成功，使用模型: ${this.model}`);
      return true;
    } catch (error) {
      console.error('初始化Gemini SDK失敗:', error);
      await LoggerService.error('初始化Gemini SDK失敗', error);
      this.genAI = null; // 初始化失敗，重置 genAI
      return false;
    }
  }

  private async ensureInitialized(): Promise<GoogleGenAI> {
    if (!this.genAI) {
      const success = await this.initialize();
      if (!success || !this.genAI) {
        throw new Error('Gemini API未初始化或初始化失敗');
      }
    }
    return this.genAI;
  }

  async generateText(prompt: string): Promise<string> {
    const genAI = await this.ensureInitialized();
    const startTime = LoggerService.apiStart('GeminiService', 'generateText', { model: this.model, promptLength: prompt.length });

    try {
      // 使用新的 SDK API 格式
      const response = await genAI.models.generateContent({
        model: this.model,
        contents: [prompt],
        config: {
          tools: [{ googleSearch: {dynamicRetrievalConfig:{
            dynamicThreshold:0,
            mode:DynamicRetrievalConfigMode.MODE_DYNAMIC
          }} }],
        },
      });

      // 從新的回應結構獲取文字
      const text = response.text || '';

      // 記錄 Google Search 結果（如果有）
    //   if (response.candidates?.[0]?.groundingMetadata?.searchEntryPoint?.renderedContent) {
    //     LoggerService.info(`Google Search結果: ${response.candidates[0].groundingMetadata.searchEntryPoint.renderedContent}`);
    //   }

      await LoggerService.apiSuccess('GeminiService', 'generateText', 
        { model: this.model, promptLength: prompt.length }, 
        { responseLength: text.length }, 
        startTime
      );
      return text;
    } catch (error) {
      await LoggerService.apiError('GeminiService', 'generateText', 
        { model: this.model, promptLength: prompt.length }, 
        error, 
        startTime
      );
      throw new Error(`Gemini 文字生成失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateImage(prompt: string): Promise<string> {
    const genAI = await this.ensureInitialized();
    const startTime = LoggerService.apiStart('GeminiService', 'generateImage', { model: this.model, promptLength: prompt.length });

    try {
      // 使用新的 SDK 圖像生成格式
      const response = await genAI.models.generateContent({
        model: this.model,
        contents: [prompt],
        config: {
          responseModalities: ["Text", "Image"],
        },
      });

      // 從新的回應結構中查找圖像資料
      if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const imageDataBase64 = part.inlineData.data;
            const mimeType = part.inlineData.mimeType;
            
            if (imageDataBase64) {
              await LoggerService.apiSuccess('GeminiService', 'generateImage', 
                { model: this.model, promptLength: prompt.length }, 
                { mimeType: mimeType, responseLength: imageDataBase64.length }, 
                startTime
              );
              
              // 返回 Base64 編碼的圖片數據
              return imageDataBase64;
            }
          }
        }
      }

      // 如果沒有找到圖像資料
      const textResponse = response.text || '';
      const warningMessage = `模型未返回預期的圖片數據 (model: ${this.model}). 可能返回了文字: ${textResponse.substring(0, 100)}`;
      await LoggerService.warn(warningMessage);
      
      throw new Error('模型未生成圖片，或無法從回應中提取圖片。');
    } catch (error) {
      await LoggerService.apiError('GeminiService', 'generateImage', 
        { model: this.model, promptLength: prompt.length }, 
        error, 
        startTime
      );
      throw new Error(`Gemini 圖片生成失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getProviderName(): AIProvider {
    return 'gemini';
  }
}

/**
 * Grok服務實現
 */
export class GrokService implements AIService {
  private client: OpenAI | null = null;
  private model: GrokTextModel | GrokImageModel;

  constructor(model?: GrokTextModel | GrokImageModel) {
    // 使用提供的模型或從設定中獲取
    if (model) {
      this.model = model;
    } else {
      // 嘗試獲取文字模型
      try {
        const lyricsSearchModel = SettingsService.getSetting('lyricsSearchModel');
        this.model = lyricsSearchModel.grok;
      } catch {
        // 如果無法獲取文字模型，使用圖片模型
        try {
          const imageGenerationModel = SettingsService.getSetting('imageGenerationModel');
          this.model = imageGenerationModel.grok;
        } catch {
          // 默認使用 grok-3-beta
          this.model = 'grok-3-beta';
        }
      }
    }
  }

  async initialize(): Promise<boolean> {
    try {
      const apiKey = SettingsService.getSetting('grokApiKey');
      if (!apiKey) {
        throw new Error('未設定Grok API金鑰');
      }
      
      // 初始化OpenAI客戶端並指向X.AI API
      this.client = new OpenAI({
        apiKey: apiKey as string,
        baseURL: 'https://api.x.ai/v1',
      });
      
      return true;
    } catch (error) {
      console.error('初始化Grok API失敗:', error);
      await LoggerService.error('初始化Grok API失敗', error);
      return false;
    }
  }

  async generateText(prompt: string): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('Grok API未初始化');
    }

    const startTime = LoggerService.apiStart('GrokService', 'generateText', { model: this.model, promptLength: prompt.length });

    try {
      // 使用OpenAI SDK格式呼叫X.AI API
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
      });

      const text = response.choices[0]?.message?.content || '';

      await LoggerService.apiSuccess('GrokService', 'generateText', 
        { model: this.model, promptLength: prompt.length }, 
        { responseLength: text.length }, 
        startTime
      );
      return text;
    } catch (error) {
      await LoggerService.apiError('GrokService', 'generateText', 
        { model: this.model, promptLength: prompt.length }, 
        error, 
        startTime
      );
      throw error;
    }
  }

  async generateImage(prompt: string): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('Grok API未初始化');
    }

    // 確認使用的是圖片生成模型
    if (this.model !== 'grok-2-image-1212') {
      // 如果目前模型不是圖片模型，暫時設為圖片模型
      this.model = 'grok-2-image-1212';
    }

    const startTime = LoggerService.apiStart('GrokService', 'generateImage', { model: this.model, promptLength: prompt.length });

    try {
      // 使用OpenAI SDK格式調用X.AI的圖片生成API
      const response = await this.client.images.generate({
        model: this.model as any, // 圖片生成模型
        prompt: prompt,
        n: 1,
        size: "1024x1024", // 一般的圖片大小
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new Error('圖片生成失敗');
      }

      await LoggerService.apiSuccess('GrokService', 'generateImage', 
        { model: this.model, promptLength: prompt.length }, 
        { url: '有URL' }, 
        startTime
      );
      return imageUrl;
    } catch (error) {
      await LoggerService.apiError('GrokService', 'generateImage', 
        { model: this.model, promptLength: prompt.length }, 
        error, 
        startTime
      );
      throw error;
    }
  }

  getProviderName(): AIProvider {
    return 'grok';
  }
}

/**
 * Anthropic Claude服務實現
 */
export class AnthropicService implements AIService {
  private apiKey: string | null = null;
  private model: AnthropicModel;

  constructor(model?: AnthropicModel) {
    // 使用提供的模型或從設定中獲取
    if (model) {
      this.model = model;
    } else {
      // 嘗試獲取文字模型 (Claude只有文字模型)
      try {
        const lyricsSearchModel = SettingsService.getSetting('lyricsSearchModel');
        this.model = lyricsSearchModel.anthropic;
      } catch {
        // 默認使用 claude-3-7-sonnet-20250219
        this.model = 'claude-3-7-sonnet-20250219';
      }
    }
  }

  async initialize(): Promise<boolean> {
    try {
      const apiKey = SettingsService.getSetting('anthropicApiKey');
      if (!apiKey) {
        throw new Error('未設定Anthropic API金鑰');
      }
      this.apiKey = apiKey;
      return true;
    } catch (error) {
      console.error('初始化Anthropic API失敗:', error);
      await LoggerService.error('初始化Anthropic API失敗', error);
      return false;
    }
  }

  async generateText(prompt: string): Promise<string> {
    if (!this.apiKey) {
      await this.initialize();
    }

    if (!this.apiKey) {
      throw new Error('Anthropic API未初始化');
    }

    const startTime = LoggerService.apiStart('AnthropicService', 'generateText', { model: this.model, promptLength: prompt.length });

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1024,
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      await LoggerService.apiSuccess('AnthropicService', 'generateText', 
        { model: this.model, promptLength: prompt.length }, 
        { responseLength: text.length }, 
        startTime
      );
      return text;
    } catch (error) {
      await LoggerService.apiError('AnthropicService', 'generateText', 
        { model: this.model, promptLength: prompt.length }, 
        error, 
        startTime
      );
      throw error;
    }
  }

  async generateImage(prompt: string): Promise<string> {
    throw new Error('Anthropic不支持圖片生成');
  }

  getProviderName(): AIProvider {
    return 'anthropic';
  }
}

/**
 * AI服務工廠
 */
export class AIServiceFactory {
  private static services: Map<string, AIService> = new Map();

  /**
   * 獲取指定AI服務提供商的服務實例
   * @param provider AI服務提供商
   * @param modelType 模型類型
   * @returns AI服務實例
   */
  public static async getService(provider: AIProvider | 'none', modelType?: string): Promise<AIService | null> {
    if (provider === 'none') {
      return null;
    }

    // 檢查緩存中是否已有服務實例
    const key = this.getServiceKey(provider, modelType);
    if (this.services.has(key)) {
      return this.services.get(key)!;
    }

    // 創建新的服務實例
    let service: AIService;
    switch (provider) {
      case 'openai':
        service = modelType ? new OpenAIService(modelType as OpenAITextModel | OpenAIImageModel) : new OpenAIService();
        break;
      case 'gemini':
        service = modelType ? new GeminiService(modelType as GeminiTextModel | GeminiImageModel) : new GeminiService();
        break;
      case 'grok':
        service = modelType ? new GrokService(modelType as GrokTextModel | GrokImageModel) : new GrokService();
        break;
      case 'anthropic':
        service = modelType ? new AnthropicService(modelType as AnthropicModel) : new AnthropicService();
        break;
      default:
        throw new Error(`不支持的AI服務提供商: ${provider}`);
    }

    // 初始化並添加到緩存
    await service.initialize();
    this.services.set(key, service);
    return service;
  }

  /**
   * 獲取功能特定的AI服務
   * @param serviceType 服務類型
   * @returns AI服務實例
   */
  public static async getServiceForFunction(serviceType: 'lyricsSearch' | 'promptGeneration' | 'imageGeneration'): Promise<AIService | null> {
    let provider: AIProvider | 'none';
    let modelType: string | undefined;
    
    switch (serviceType) {
      case 'lyricsSearch':
        provider = SettingsService.getSetting('lyricsSearchProvider');
        if (provider !== 'none') {
          const modelSettings = SettingsService.getSetting('lyricsSearchModel');
          modelType = modelSettings[provider];
        }
        break;
      case 'promptGeneration':
        provider = SettingsService.getSetting('promptGenerationProvider');
        if (provider !== 'none') {
          const modelSettings = SettingsService.getSetting('promptGenerationModel');
          modelType = modelSettings[provider];
        }
        break;
      case 'imageGeneration':
        provider = SettingsService.getSetting('imageGenerationProvider');
        if (provider !== 'none') {
          // 圖像生成服務需要特殊處理，因為Anthropic不支持圖片生成
          const imageProvider = provider as 'openai' | 'gemini' | 'grok' | 'anthropic';
          if (imageProvider === 'anthropic') {
            LoggerService.warn('Anthropic不支持圖片生成，但被選為圖片生成提供商');
            return null;
          }
          const modelSettings = SettingsService.getSetting('imageGenerationModel');
          modelType = modelSettings[provider];
        }
        break;
      default:
        return null;
    }

    return this.getService(provider, modelType);
  }

  /**
   * 清除已緩存的服務實例
   */
  public static clearServices(): void {
    this.services.clear();
  }

  /**
   * 獲取服務緩存鍵
   * @param provider AI服務提供商
   * @param modelType 模型類型
   * @returns 緩存鍵
   */
  private static getServiceKey(provider: AIProvider, modelType?: string): string {
    return modelType ? `${provider}_${modelType}` : provider;
  }
} 