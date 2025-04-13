/// <reference types="node" />
/// <reference types="electron" />

import { SettingsService } from './settings';
import { LoggerService } from './logger';
import { AIServiceFactory } from './aiService';

/**
 * 提示詞生成服務
 * 負責使用AI生成高質量的提示詞
 */
export class PromptGenerationService {
  /**
   * 生成提示詞
   * @param songTitle 歌曲標題
   * @param lyrics 歌詞
   * @param basePrompt 基本提示詞模板
   * @returns 增強的提示詞
   */
  public static async generatePrompt(
    songTitle: string,
    lyrics: string,
    basePrompt?: string
  ): Promise<string> {
    const startTime = LoggerService.apiStart('PromptGenerationService', 'generatePrompt', 
      { songTitle, lyricsLength: lyrics?.length });
    
    try {
      // 檢查是否設定使用AI生成提示詞
      const promptGenerationProvider = SettingsService.getSetting('promptGenerationProvider');
      if (promptGenerationProvider === 'none') {
        // 如果設定不使用AI，則直接使用基本提示詞
        const promptTemplate = basePrompt || SettingsService.getSetting('imagePromptTemplate');
        const lyricsExcerpt = lyrics?.substring(0, 300) || '';
        const finalPrompt = promptTemplate
          .replace('{{lyrics}}', lyricsExcerpt)
          .replace('{{songTitle}}', songTitle);
          
        await LoggerService.apiSuccess('PromptGenerationService', 'generatePrompt', 
          { songTitle, lyricsLength: lyrics?.length }, 
          { usingTemplate: true }, 
          startTime);
        
        return finalPrompt;
      }
      
      // 獲取AI服務
      const aiService = await AIServiceFactory.getServiceForFunction('promptGeneration');
      if (!aiService) {
        throw new Error('未找到有效的AI服務，請檢查API設定');
      }

      // 獲取基本提示詞模板
      const lyricsExcerpt = lyrics?.substring(0, 300) || '';
      
      // 構建增強提示詞的請求
      const enhancementPrompt = `**生成圖片描述**：根據歌詞分析結果，構思一個最能配合這首歌意境的背景圖片，最好能單一色調、色差柔和、細節少，減少觀看者因為背景圖片而從歌詞分心的機會。請提供詳細的「圖片描述」（英文尤佳，方便後續給圖像生成模型使用），例如："A lone figure walking on a rainy street at night under a single yellow streetlight, evoking feelings of melancholy and solitude."。
歌詞如下：${lyricsExcerpt}

請直接返回"一段"完整的圖片描述，無需解釋或添加額外文字。`;

      // 使用AI服務增強提示詞
      const enhancedPrompt = await aiService.generateText(enhancementPrompt);
      
      // 處理AI返回的內容
      const finalPrompt = enhancedPrompt?.trim();
      
      await LoggerService.apiSuccess('PromptGenerationService', 'generatePrompt', 
        { songTitle, lyricsLength: lyrics?.length, provider: aiService.getProviderName() }, 
        { promptLength: finalPrompt.length }, 
        startTime);
      
      return finalPrompt;
    } catch (error) {
      console.error('生成提示詞失敗:', error);
      await LoggerService.apiError('PromptGenerationService', 'generatePrompt', 
        { songTitle, lyricsLength: lyrics?.length }, 
        error, 
        startTime);
        
      // 失敗時回退到基本提示詞
      const promptTemplate = basePrompt || SettingsService.getSetting('imagePromptTemplate');
      const lyricsExcerpt = lyrics?.substring(0, 300) || '';
      return promptTemplate
        .replace('{{lyrics}}', lyricsExcerpt)
        .replace('{{songTitle}}', songTitle);
    }
  }
} 