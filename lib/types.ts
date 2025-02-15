export interface Costume {
  id: string;
  name: string;
  prompt: string;
  gender: 'boy' | 'girl';
  description: string;
}

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
} 