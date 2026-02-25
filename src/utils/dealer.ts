import type { Card, Suit, Rank } from '../types/game';
import { createCard } from './cardUtils';

// 所有花色
export const ALL_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

// 所有点数（不包括大小王）
export const ALL_RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

/**
 * 生成伪随机数生成器（基于种子）
 */
function seededRandom(seed: string): () => number {
  // 使用简单的字符串哈希算法
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  // 使用 Mulberry32 算法
  return function() {
    let t = hash += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * 创建完整的牌堆（N副牌）
 */
export function createDeck(deckCount: number = 1): Card[] {
  const deck: Card[] = [];
  let cardId = 0;
  
  for (let d = 0; d < deckCount; d++) {
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        deck.push(createCard(suit, rank, `card_${d}_${cardId++}`));
      }
    }
  }
  
  return deck;
}

/**
 * 洗牌（Fisher-Yates 算法，使用种子）
 */
export function shuffleDeck(deck: Card[], seed: string): Card[] {
  const random = seededRandom(seed);
  const shuffled = [...deck];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = shuffled[i]!;
    if (shuffled[j] !== undefined) {
      shuffled[i] = shuffled[j]!;
    }
    shuffled[j] = temp;
  }
  
  return shuffled;
}

/**
 * 发牌
 */
export function dealCards(deck: Card[], playerCount: number): Card[][] {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  
  // 简单的轮询发牌
  deck.forEach((card, index) => {
    const playerIndex = index % playerCount;
    const hand = hands[playerIndex];
    if (hand) {
      hand.push(card);
    }
  });
  
  return hands;
}

/**
 * 完整的发牌流程（确定性）
 */
export function dealGame(seed: string, deckCount: number, playerCount: number): Card[][] {
  // 1. 创建牌堆
  const deck = createDeck(deckCount);
  
  // 2. 洗牌（使用种子）
  const shuffledDeck = shuffleDeck(deck, seed);
  
  // 3. 发牌
  const hands = dealCards(shuffledDeck, playerCount);
  
  return hands;
}

/**
 * 生成随机种子
 */
export function generateSeed(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 查找红桃3的持有者
 */
export function findRedHeart3Holder(hands: Card[][]): number | null {
  for (let i = 0; i < hands.length; i++) {
    const hand = hands[i];
    if (hand && hand.some(card => card.isRedHeart3)) {
      return i;
    }
  }
  return null;
}

/**
 * 计算每个玩家的手牌数量
 */
export function countHandCards(hands: Card[][]): number[] {
  return hands.map(hand => hand.length);
}