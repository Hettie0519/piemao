import type { Card, Rank, Suit, Hand, HandValidation } from '../types/game';
import { HandType, ComparisonResult } from '../types/game';

// 牌值映射（从大到小）
export const RANK_VALUES: Record<Rank, number> = {
  '2': 15,
  'A': 14,
  'K': 13,
  'Q': 12,
  'J': 11,
  '10': 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
};

// 花色映射
export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const SUIT_NAMES: Record<Suit, string> = {
  hearts: '红桃',
  diamonds: '方块',
  clubs: '梅花',
  spades: '黑桃',
};

/**
 * 创建一张牌
 */
export function createCard(suit: Suit, rank: Rank, id: string): Card {
  return {
    id,
    suit,
    rank,
    value: RANK_VALUES[rank],
    isRedHeart3: suit === 'hearts' && rank === '3',
  };
}

/**
 * 比较两张牌的大小
 */
export function compareCards(card1: Card, card2: Card): number {
  if (card1.value !== card2.value) {
    return card1.value - card2.value;
  }
  // 相同点数时比较花色
  const suitOrder: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
  return suitOrder.indexOf(card1.suit) - suitOrder.indexOf(card2.suit);
}

/**
 * 判断是否为对子
 */
function isPair(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return cards[0]?.rank === cards[1]?.rank;
}

/**
 * 判断是否为顺子（链链）
 */
function isStraight(cards: Card[], minLength: number = 3): boolean {
  if (cards.length < minLength) return false;
  
  // 顺子不能包含2
  if (cards.some(c => c.rank === '2')) return false;
  
  // 检查是否连续
  const sorted = [...cards].sort((a, b) => a.value - b.value);
  for (let i = 1; i < sorted.length; i++) {
    if (!sorted[i] || !sorted[i - 1]) return false;
    const current = sorted[i]!;
    const prev = sorted[i - 1]!;
    if (current.value - prev.value !== 1) {
      return false;
    }
  }
  return true;
}

/**
 * 判断是否为姐妹对
 */
function isSisterPair(cards: Card[], minLength: number = 3): boolean {
  if (cards.length % 2 !== 0) return false;
  const pairCount = cards.length / 2;
  if (pairCount < minLength) return false;
  
  // 姐妹对不能包含2
  if (cards.some(c => c.rank === '2')) return false;
  
  // 按点数分组
  const rankGroups = new Map<Rank, Card[]>();
  cards.forEach(card => {
    if (!rankGroups.has(card.rank)) {
      rankGroups.set(card.rank, []);
    }
    const group = rankGroups.get(card.rank);
    if (group) {
      group.push(card);
    }
  });
  
  // 检查每组是否都是对子
  for (const group of rankGroups.values()) {
    if (group.length !== 2) return false;
  }
  
  // 检查是否连续
  const ranks = Array.from(rankGroups.keys()).sort((a, b) => RANK_VALUES[a] - RANK_VALUES[b]);
  for (let i = 1; i < ranks.length; i++) {
    const currentRank = ranks[i];
    const prevRank = ranks[i - 1];
    if (!currentRank || !prevRank) return false;
    if (RANK_VALUES[currentRank] - RANK_VALUES[prevRank] !== 1) {
      return false;
    }
  }
  
  return true;
}

/**
 * 判断是否为炸弹（3张同点）
 */
function isBomb(cards: Card[]): boolean {
  if (cards.length !== 3) return false;
  const firstCard = cards[0];
  return firstCard ? cards.every(c => c.rank === firstCard.rank) : false;
}

/**
 * 判断是否为轰雷（4张同点）
 */
function isThunder(cards: Card[]): boolean {
  if (cards.length !== 4) return false;
  const firstCard = cards[0];
  return firstCard ? cards.every(c => c.rank === firstCard.rank) : false;
}

/**
 * 判断是否为多张同点（5张及以上）
 */
function isMulti(cards: Card[]): boolean {
  if (cards.length < 5) return false;
  const firstCard = cards[0];
  return firstCard ? cards.every(c => c.rank === firstCard.rank) : false;
}

/**
 * 判断是否为"起子"（4的特殊权限）
 */
function isQiZi(cards: Card[], targetType: HandType, targetCount: number): boolean {
  if (!cards.every(c => c.rank === '4')) return false;
  
  const count = cards.length;
  
  switch (targetType) {
    case HandType.BOMB:
      // 对4压制炸弹（3张）
      return count === 2;
    case HandType.THUNDER:
      // 三张4压制轰雷（4张）
      return count === 3;
    case HandType.MULTI:
      // N张4压制N+1张其他同点牌
      return count >= 4 && count === targetCount - 1;
    default:
      return false;
  }
}

/**
 * 判定牌型
 */
export function validateHand(cards: Card[], minStraight: number = 3, minSisterPair: number = 3): HandValidation {
  if (cards.length === 0) {
    return { valid: false, error: '请选择牌' };
  }
  
  // 单牌
  if (cards.length === 1) {
    return { valid: true, type: HandType.SINGLE, isQiZi: false };
  }
  
  // 对子
  if (isPair(cards)) {
    // 对4本身不是起子，只有在打炸弹时才发挥起子作用
    return { valid: true, type: HandType.PAIR, isQiZi: false };
  }
  
  // 顺子
  if (isStraight(cards, minStraight)) {
    return { valid: true, type: HandType.STRAIGHT, isQiZi: false };
  }
  
  // 姐妹对
  if (isSisterPair(cards, minSisterPair)) {
    return { valid: true, type: HandType.SISTER_PAIR, isQiZi: false };
  }
  
  // 炸弹（3张同点）
  if (isBomb(cards)) {
    return { valid: true, type: HandType.BOMB, isQiZi: false };
  }
  
  // 轰雷（4张同点）
  if (isThunder(cards)) {
    return { valid: true, type: HandType.THUNDER, isQiZi: false };
  }
  
  // 多张同点（5张及以上）
  if (isMulti(cards)) {
    return { valid: true, type: HandType.MULTI, isQiZi: false };
  }
  
  return { valid: false, error: '无效的牌型' };
}

/**
 * 创建手牌对象
 */
export function createHand(cards: Card[], validation: HandValidation): Hand {
  const firstCard = cards[0];
  return {
    type: validation.type!,
    cards,
    count: cards.length,
    rank: firstCard?.rank || '3',
    isQiZi: validation.isQiZi || false,
  };
}

/**
 * 比较两个牌型
 */
export function compareHands(hand1: Hand, hand2: Hand | null): ComparisonResult {
  if (!hand2) return ComparisonResult.WIN;
  
  // 如果是起子，特殊处理
  if (hand1.isQiZi) {
    return ComparisonResult.WIN;
  }
  
  // 如果上家是起子，需要更多张数才能管住
  if (hand2.isQiZi) {
    // 普通牌型（单牌、对子、顺子、姐妹对）不能管住起子
    const isHand1Normal = [HandType.SINGLE, HandType.PAIR, HandType.STRAIGHT, HandType.SISTER_PAIR].includes(hand1.type);
    if (isHand1Normal) {
      return ComparisonResult.LOSE;
    }
    
    // 压制起子：同类型更多张数的4 或 多2张的普通牌
    const isSameType = hand1.type === hand2.type;
    const isAll4 = hand1.cards.every(c => c.rank === '4');
    
    if (isSameType && isAll4) {
      // 同类型都是4，需要更多张数
      return hand1.count > hand2.count ? ComparisonResult.WIN : ComparisonResult.LOSE;
    }
    
    // 普通牌需要多2张
    return hand1.count >= hand2.count + 2 ? ComparisonResult.WIN : ComparisonResult.LOSE;
  }
  
  // 同类型比较（包括普通牌型和特殊牌型）
  if (hand1.type === hand2.type) {
    if (hand1.count !== hand2.count) {
      return ComparisonResult.INVALID;
    }
    
    // 正常的点数比较
    if (RANK_VALUES[hand1.rank] > RANK_VALUES[hand2.rank]) {
      return ComparisonResult.WIN;
    }
    return ComparisonResult.LOSE;
  }
  
  // 普通牌型（单牌、对子、顺子、姐妹对）
  const isHand1Normal = [HandType.SINGLE, HandType.PAIR, HandType.STRAIGHT, HandType.SISTER_PAIR].includes(hand1.type);
  const isHand2Normal = [HandType.SINGLE, HandType.PAIR, HandType.STRAIGHT, HandType.SISTER_PAIR].includes(hand2.type);
  
  // 跨类型的普通牌型不能互相管住
  if (isHand1Normal && isHand2Normal) {
    return ComparisonResult.INVALID;
  }
  
  // 特殊牌型之间的比较（炸弹 < 雷 < 多张）
  const isHand1Special = [HandType.BOMB, HandType.THUNDER, HandType.MULTI].includes(hand1.type);
  const isHand2Special = [HandType.BOMB, HandType.THUNDER, HandType.MULTI].includes(hand2.type);
  
  if (isHand1Special && isHand2Special) {
    // 同类型比较
    if (hand1.type === hand2.type) {
      console.log('同类型特殊牌型比较:', hand1.type, hand1.rank, 'vs', hand2.rank);
      console.log('RANK_VALUES:', RANK_VALUES[hand1.rank], 'vs', RANK_VALUES[hand2.rank]);
      
      if (hand1.count !== hand2.count) {
        console.log('张数不同，无法管住');
        return ComparisonResult.INVALID;
      }
      if (RANK_VALUES[hand1.rank] > RANK_VALUES[hand2.rank]) {
        console.log('点数更大，可以管住');
        return ComparisonResult.WIN;
      }
      console.log('点数更小，无法管住');
      return ComparisonResult.LOSE;
    }
    
    // 跨类型比较：炸弹 < 雷 < 多张
    const typeRank: Record<string, number> = { 
      [HandType.BOMB]: 1, 
      [HandType.THUNDER]: 2, 
      [HandType.MULTI]: 3 
    };
    const hand1Rank = typeRank[hand1.type];
    const hand2Rank = typeRank[hand2.type];
    if (hand1Rank !== undefined && hand2Rank !== undefined && hand1Rank > hand2Rank) {
      return ComparisonResult.WIN;
    }
    return ComparisonResult.LOSE;
  }
  
  // 姐妹对只能被更大的姐妹对、雷或多张管住
  if (hand2.type === HandType.SISTER_PAIR) {
    if (hand1.type === HandType.SISTER_PAIR) {
      // 同类型比较
      if (RANK_VALUES[hand1.rank] > RANK_VALUES[hand2.rank]) {
        return ComparisonResult.WIN;
      }
      return ComparisonResult.LOSE;
    } else if (hand1.type === HandType.THUNDER) {
      // 雷可以管住姐妹对
      return ComparisonResult.WIN;
    } else if (hand1.type === HandType.MULTI) {
      // 多张（比雷大）可以管住姐妹对
      return ComparisonResult.WIN;
    } else {
      // 其他牌型不能管住姐妹对
      return ComparisonResult.INVALID;
    }
  }
  
  // 多张、炸弹、雷可以管住普通牌型（单牌、对子、顺子），但不能管住姐妹对
  const specialTypes = [HandType.BOMB, HandType.THUNDER, HandType.MULTI];
  if (specialTypes.includes(hand1.type) && isHand2Normal) {
    return ComparisonResult.WIN;
  }
  
  // 其他情况不能管住
  return ComparisonResult.LOSE;
}

/**
 * 检查是否可以管住上家的牌
 */
export function canBeatHand(cards: Card[], lastHand: Hand | null, minStraight: number = 3, minSisterPair: number = 3): { canBeat: boolean; isQiZi: boolean } {
  const validation = validateHand(cards, minStraight, minSisterPair);
  if (!validation.valid) {
    return { canBeat: false, isQiZi: false };
  }
  
  const hand = createHand(cards, validation);
  
  // 没有上家牌，可以出
  if (!lastHand) {
    return { canBeat: true, isQiZi: false };
  }
  
  // 检查是否为起子
  let qiZi = false;
  if (lastHand && !lastHand.isQiZi) {
    // 根据上家牌的张数判断目标类型
    if (lastHand.count === 3 && lastHand.type === HandType.BOMB) {
      qiZi = isQiZi(cards, HandType.BOMB, 3);
    } else if (lastHand.count === 4 && lastHand.type === HandType.THUNDER) {
      qiZi = isQiZi(cards, HandType.THUNDER, 4);
    } else if (lastHand.count >= 5 && lastHand.type === HandType.MULTI) {
      qiZi = isQiZi(cards, HandType.MULTI, lastHand.count);
    }
  }
  
  if (qiZi) {
    return { canBeat: true, isQiZi: true };
  }
  
  // 普通比较
  const result = compareHands(hand, lastHand);
  return { canBeat: result === ComparisonResult.WIN, isQiZi: false };
}

/**
 * 排序手牌
 */
export function sortCards(cards: Card[], sortBy: 'value' | 'suit' = 'value'): Card[] {
  return [...cards].sort((a, b) => {
    if (sortBy === 'value') {
      if (a.value !== b.value) {
        return b.value - a.value; // 降序
      }
      return compareCards(a, b);
    } else {
      // 按花色排序
      const suitOrder: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
      const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      return b.value - a.value;
    }
  });
}

/**
 * 格式化牌面显示
 */
export function formatCard(card: Card): string {
  return `${SUIT_SYMBOLS[card.suit]}${card.rank}`;
}

/**
 * 检查是否包含红桃3
 */
export function hasRedHeart3(cards: Card[]): boolean {
  return cards.some(c => c.isRedHeart3);
}