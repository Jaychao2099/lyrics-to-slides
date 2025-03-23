import axios from 'axios';
import { Song } from '../types';

// OpenAI API 配置
const openaiConfig = {
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Content-Type': 'application/json',
  }
};

// 創建API實例
const openaiAxios = axios.create(openaiConfig);

// 搜索歌詞
export const searchLyrics = async (songTitle: string, apiService: string, apiKey: string): Promise<string> => {
  try {
    if (apiService === 'openai') {
      // 創建OpenAI API請求頭
      openaiAxios.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
      
      // 調用OpenAI API
      const response = await openaiAxios.post('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '您是一個專業的歌詞搜索助手。請提供準確的歌詞，不要包含額外解釋。僅返回歌詞內容。'
          },
          {
            role: 'user',
            content: `請搜索並提供"${songTitle}"的完整歌詞。只返回歌詞文本，不要有額外說明或格式符號。`
          }
        ],
        temperature: 0.7
      });

      return response.data.choices[0].message.content.trim();
    } else if (apiService === 'google') {
      // 可以接入Google搜索API
      throw new Error('Google搜索API尚未實現');
    } else if (apiService === 'custom') {
      // 可以實現自定義API調用
      throw new Error('自定義API尚未實現');
    } else {
      throw new Error('不支持的API服務');
    }
  } catch (error) {
    console.error('歌詞搜索失敗:', error);
    return '無法搜索歌詞，請檢查API設置和網絡連接。';
  }
};

// 生成圖片
export const generateImage = async (songTitle: string, apiService: string, apiKey: string): Promise<string> => {
  try {
    if (apiService === 'openai' || apiService === 'dalle') {
      // 創建OpenAI API請求頭
      openaiAxios.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
      
      // 根據歌名生成圖片
      const response = await openaiAxios.post('/images/generations', {
        model: 'dall-e-3',
        prompt: `美麗的圖像代表歌曲"${songTitle}"的主題和情感，高雅藝術風格，適合作為投影片背景。`,
        n: 1,
        size: '1024x1024'
      });

      return response.data.data[0].url;
    } else if (apiService === 'custom') {
      // 可以實現自定義API調用
      throw new Error('自定義圖像服務尚未實現');
    } else {
      throw new Error('不支持的API服務');
    }
  } catch (error) {
    console.error('圖片生成失敗:', error);
    return '';
  }
};

// 格式化Markdown模板
export const formatSlideMarkdown = (song: Song): string => {
  const { title, lyrics, imageUrl } = song;
  
  // 如果沒有歌詞或圖片，則返回空字符串
  if (!lyrics || !imageUrl) {
    return '';
  }
  
  // 分割歌詞為多行
  const lines = lyrics.split('\n');
  
  // 創建Markdown內容
  let markdown = `---\nmarp: true\ntheme: default\n---\n\n`;
  
  // 添加標題幻燈片
  markdown += `![bg blur:5px brightness:0.7](${imageUrl})\n\n# ${title}\n\n---\n\n`;
  
  // 按每幻燈片5行分割歌詞
  const slidesCount = Math.ceil(lines.length / 5);
  for (let i = 0; i < slidesCount; i++) {
    const slideLines = lines.slice(i * 5, i * 5 + 5);
    markdown += `![bg blur:5px brightness:0.8](${imageUrl})\n\n`;
    markdown += slideLines.join('\n\n');
    markdown += '\n\n---\n\n';
  }
  
  return markdown;
}; 