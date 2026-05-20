import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, ImageBackground, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock3, MessageCircle, ReceiptText, SendHorizonal, ShoppingBag, Sparkles, UtensilsCrossed } from 'lucide-react-native';
import { menu } from '../constants/menu';
import { AIResponse, Category, MenuItem, PlacedOrder } from '../types';
import { sendAIOrder } from '../services/api';
import { useCartStore } from '../store/cartStore';

type Tab = 'concierge' | 'order' | 'menu' | 'cart' | 'orders';
type MenuFilter = 'All' | Category;

const gold = '#D9A441';
const paleGold = '#F1C46D';
const serif = { fontFamily: 'Georgia' };
const menuFilters: MenuFilter[] = ['All', 'Mains', 'Sides', 'Drinks', 'Desserts'];

export default function HomeScreen() {
  const [tab, setTab] = useState<Tab>('concierge');
  const [filter, setFilter] = useState<MenuFilter>('All');
  const [message, setMessage] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const items = useCartStore(state => state.items);
  const addItem = useCartStore(state => state.addItem);
  const total = useCartStore(state => state.total);
  const subtotal = useCartStore(state => state.subtotal);
  const tax = useCartStore(state => state.tax);
  const updateQuantity = useCartStore(state => state.updateQuantity);
  const removeItem = useCartStore(state => state.removeItem);
  const placeOrder = useCartStore(state => state.placeOrder);
  const cancelOrder = useCartStore(state => state.cancelOrder);
  const reorderOrder = useCartStore(state => state.reorderOrder);
  const resetDemo = useCartStore(state => state.resetDemo);
  const orders = useCartStore(state => state.orders);
  const applyAIResponse = useCartStore(state => state.applyAIResponse);
  const conversation = useCartStore(state => state.conversation);
  const lastAssistantMessage = useCartStore(state => state.lastAssistantMessage);
  const lastSuggestedItems = useCartStore(state => state.lastSuggestedItems);
  const lastAIResponse = useCartStore(state => state.lastAIResponse);
  const activeFilter = useCartStore(state => state.activeFilter);
  const clearFilter = useCartStore(state => state.clearFilter);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const recommended = menu.filter(item => ['stellar_chocolate_mousse', 'espresso_martini'].includes(item.id));
  const featured = menu.filter(item => ['stellar_chocolate_mousse', 'espresso_martini', 'classic_bistro_burger', 'spicy_chicken_sandwich'].includes(item.id));
  const baseVisibleMenu = filter === 'All' ? menu : menu.filter(item => item.category === filter);
  const visibleMenu = activeFilter
    ? menu.filter(item => item.category === activeFilter || item.tags.some(tag => tag.toLowerCase() === activeFilter.toLowerCase()))
    : baseVisibleMenu;
  const aiSuggested = useMemo(() => {
    const fromAI = menu.filter(item => lastSuggestedItems.includes(item.id));
    return fromAI.length ? fromAI.slice(0, 2) : recommended;
  }, [lastSuggestedItems]);

  const askAI = async (override?: string) => {
    const text = (override || message).trim();
    if (!text || loading) return;
    setLoading(true);
    setConfirmed(false);
    setTab('order');
    try {
      const response = await sendAIOrder(text, items, conversation);
      applyAIResponse(response, text);
      const filterAction = response.actions.find(action => action.type === 'SHOW_CATEGORY' || action.type === 'SHOW_FILTERED_ITEMS');
      if (filterAction?.type === 'SHOW_CATEGORY' && menuFilters.includes(filterAction.category as MenuFilter)) {
        setFilter(filterAction.category as MenuFilter);
        setTab('menu');
      }
      setMessage('');
      setAddedMessage('AI built your order. Review customizations or approve it.');
      setTimeout(() => setAddedMessage(null), 2600);
    } finally {
      setLoading(false);
    }
  };

  const notifyAdded = (item: MenuItem) => {
    addItem(item);
    setAddedMessage(`${item.name} added to cart`);
    setTimeout(() => setAddedMessage(null), 2200);
  };

  const checkout = () => {
    const placed = placeOrder();
    if (placed) {
      setConfirmed(true);
      setTab('orders');
    }
  };

  const renderContent = () => {
    if (tab === 'order') {
      return (
        <OrderScreen
          message={message}
          setMessage={setMessage}
          focused={focused}
          setFocused={setFocused}
          loading={loading}
          askAI={askAI}
          conversation={conversation}
          suggested={aiSuggested}
          addItem={notifyAdded}
          items={items}
          total={total()}
          itemCount={itemCount}
          checkout={checkout}
          lastAssistantMessage={lastAssistantMessage}
          updateQuantity={updateQuantity}
          removeItem={removeItem}
          lastAIResponse={lastAIResponse}
        />
      );
    }
    if (tab === 'menu') {
      return <MenuScreen filter={filter} setFilter={next => { clearFilter(); setFilter(next); }} activeFilter={activeFilter} clearFilter={clearFilter} visibleMenu={visibleMenu} addItem={notifyAdded} width={width} />;
    }
    if (tab === 'cart') {
      return <CartScreen items={items} total={total()} itemCount={itemCount} askAI={() => setTab('order')} checkout={checkout} updateQuantity={updateQuantity} removeItem={removeItem} />;
    }
    if (tab === 'orders') {
      return <OrdersScreen confirmed={confirmed} orders={orders} cancelOrder={cancelOrder} reorderOrder={orderId => { reorderOrder(orderId); setTab('cart'); }} />;
    }
    return <ConciergeHome askAI={askAI} recommended={recommended} featured={featured} addItem={notifyAdded} goOrder={() => setTab('order')} resetDemo={resetDemo} />;
  };

  return (
    <LinearGradient colors={['#1F1F23', '#17171A']} className="flex-1">
      <SafeAreaView className="flex-1">
        <View className="flex-1 bg-[#050505]" style={{ alignSelf: 'center', maxWidth: isWide ? 420 : undefined, width: '100%' }}>
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 92 }}>
            {renderContent()}
          </ScrollView>
          {addedMessage ? (
            <View className="absolute left-4 right-4 bottom-24 rounded-2xl border border-[#D9A441]/40 bg-[#17120A] px-4 py-3">
              <Text className="text-center font-black text-[#F1C46D]">{addedMessage}</Text>
            </View>
          ) : null}
          <BottomTabs tab={tab} setTab={setTab} itemCount={itemCount} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Orb({ size = 88 }: { size?: number }) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 2600, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-3, 4] });
  const scale = drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <Animated.View className="items-center justify-center" style={{ width: size, height: size, transform: [{ translateY }, { translateX }, { scale }] }}>
      <View className="absolute rounded-full bg-[#241C10]" style={{ width: size, height: size, opacity: 0.88 }} />
      <View className="absolute rounded-full bg-[#4B3515]" style={{ width: size * 0.62, height: size * 0.62 }} />
      <LinearGradient colors={['#FFD889', '#D79B39']} className="rounded-full" style={{ width: size * 0.46, height: size * 0.46 }} />
      <View className="absolute rounded-full bg-white/25" style={{ left: size * 0.32, top: size * 0.28, width: size * 0.2, height: size * 0.2 }} />
    </Animated.View>
  );
}

function ConciergeHome({ askAI, recommended, featured, addItem, goOrder, resetDemo }: { askAI: (prompt: string) => void; recommended: MenuItem[]; featured: MenuItem[]; addItem: (item: MenuItem) => void; goOrder: () => void; resetDemo: () => void }) {
  return (
    <View className="px-4 pt-9">
      <View className="items-center">
        <View className="mb-4 rounded-full bg-[#120F0A]" style={{ shadowColor: gold, shadowOpacity: 0.12, shadowRadius: 60 }}>
          <Orb size={148} />
        </View>
        <Text className="text-base font-semibold text-neutral-400">Good evening</Text>
        <Text className="mt-1 text-center text-4xl font-black leading-tight text-white" style={serif}>What would you like tonight?</Text>
      </View>

      <View className="mt-6 gap-3">
        {[
          'Add two spicy chicken sandwiches',
          'Build dinner for two under 900 calories each',
          'Make my burger vegetarian',
          'What pairs well with truffle fries?'
        ].map(prompt => (
          <Pressable key={prompt} onPress={() => askAI(prompt)} className="self-start rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5">
            <Text className="text-sm font-black text-neutral-300"><Text style={{ color: gold }}>✣ </Text>{prompt}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={goOrder} className="mt-7 overflow-hidden rounded-2xl">
        <LinearGradient colors={['#C8923C', '#F1C46D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="flex-row items-center justify-center gap-3 py-5">
          <Text className="text-base font-black text-black">Order with AI</Text>
          <Text className="text-xl text-black">›</Text>
        </LinearGradient>
      </Pressable>
      <Pressable onPress={resetDemo} className="mt-3 items-center rounded-full border border-white/10 bg-white/[0.05] py-3">
        <Text className="text-xs font-black uppercase tracking-widest text-neutral-300">Reset Loom Demo</Text>
      </Pressable>

      <SectionHeader title="AI Recommends" icon="↗" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3 pr-4">
          {recommended.map(item => <LargeDishCard key={item.id} item={item} onAdd={() => addItem(item)} />)}
        </View>
      </ScrollView>

      <SectionHeader title="Featured Dishes" icon="☆" />
      <View className="flex-row flex-wrap justify-between gap-y-3">
        {featured.map(item => <FeaturedCard key={item.id} item={item} onAdd={() => addItem(item)} />)}
      </View>
    </View>
  );
}

function OrderScreen(props: {
  message: string;
  setMessage: (value: string) => void;
  focused: boolean;
  setFocused: (value: boolean) => void;
  loading: boolean;
  askAI: (prompt?: string) => void;
  conversation: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
  suggested: MenuItem[];
  addItem: (item: MenuItem) => void;
  items: Array<MenuItem & { quantity: number; modifiers?: Record<string, unknown>; notes?: string[] }>;
  total: number;
  itemCount: number;
  checkout: () => void;
  lastAssistantMessage: string;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  lastAIResponse: AIResponse | null;
}) {
  const quick = ['I want something spicy', 'Healthy lunch under 600 cal', 'Surprise me with dessert'];
  const hasConversation = props.conversation.length > 1;
  return (
    <View className="min-h-screen">
      <View className="border-b border-white/10 px-4 py-6">
        <View className="flex-row items-center gap-3">
          <Orb size={58} />
          <View>
            <Text className="text-lg font-black text-white">AI Concierge</Text>
            <Text className="text-xs font-bold text-emerald-400">● Online</Text>
          </View>
        </View>
      </View>

      <View className="px-4 py-7">
        {!hasConversation ? (
          <View className="items-center">
            <Orb size={104} />
            <Text className="mt-5 text-center text-3xl font-black leading-tight text-white" style={serif}>Welcome to The Intelligent Bistro</Text>
            <Text className="mt-3 max-w-[300px] text-center text-base leading-6 text-neutral-400">Tell me what you would like to eat. I understand natural language, dietary preferences, and pairings.</Text>
            <View className="mt-6 gap-3">
              {quick.map(prompt => (
                <Pressable key={prompt} onPress={() => props.askAI(prompt)} className="rounded-full border border-white/10 bg-white/[0.07] px-4 py-2.5">
                  <Text className="text-sm font-black text-neutral-200"><Text style={{ color: gold }}>✣ </Text>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View className="gap-3">
            {props.conversation.slice(-6).map(chat => (
              <View key={chat.id} className={`max-w-[86%] rounded-2xl px-4 py-3 ${chat.role === 'user' ? 'self-end bg-[#D9A441]' : 'self-start bg-white/[0.08]'}`}>
                <Text className={`text-sm font-semibold leading-5 ${chat.role === 'user' ? 'text-black' : 'text-white'}`}>{chat.content}</Text>
              </View>
            ))}
          </View>
        )}

        {props.lastAIResponse && hasConversation ? <AIDecisionCard response={props.lastAIResponse} /> : null}

        {props.items.length ? (
          <View className="mt-6 rounded-2xl border border-white/10 bg-white/[0.07] p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-black text-white">Current Order</Text>
              <Text className="font-black text-[#F1C46D]">${props.total.toFixed(2)}</Text>
            </View>
            <View className="gap-3">
              {props.items.map(item => (
                <OrderLine key={item.id} item={item} updateQuantity={props.updateQuantity} removeItem={props.removeItem} />
              ))}
            </View>
            <View className="mt-4 rounded-2xl border border-[#D9A441]/20 bg-[#D9A441]/10 p-3">
              <Text className="font-black text-[#F1C46D]">Want to customize it?</Text>
              <Text className="mt-1 text-xs leading-5 text-neutral-300">Ask me to remove an ingredient, add a side, pair a drink, or send it as-is.</Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {['remove sauce', 'add ranch', 'pair a drink', 'cancel order'].map(prompt => (
                  <Pressable key={prompt} onPress={() => props.askAI(prompt)} className="rounded-full bg-white/10 px-3 py-2">
                    <Text className="text-xs font-black text-neutral-200">{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable onPress={props.checkout} className="mt-4 overflow-hidden rounded-2xl">
              <LinearGradient colors={['#C8923C', '#F1C46D']} className="items-center py-4">
                <Text className="font-black text-black">Approve AI Order</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {hasConversation ? <SuggestedTray suggested={props.suggested} addItem={props.addItem} lastAssistantMessage={props.lastAssistantMessage} /> : null}
      </View>

      <View className="mt-auto border-t border-white/10 px-3 py-3">
        <View className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${props.focused ? 'border-[#D9A441] bg-white/[0.09]' : 'border-white/10 bg-white/[0.06]'}`}>
          <TextInput
            value={props.message}
            onChangeText={props.setMessage}
            onFocus={() => props.setFocused(true)}
            onBlur={() => props.setFocused(false)}
            placeholder="Tell me what you'd like..."
            placeholderTextColor="#777"
            className="flex-1 text-base text-white"
            cursorColor={paleGold}
            selectionColor={paleGold}
            returnKeyType="send"
            onSubmitEditing={() => props.askAI()}
            style={{ outlineStyle: 'none' } as never}
          />
          <Pressable onPress={() => props.askAI()} className="h-11 w-11 items-center justify-center rounded-full bg-[#8A672C]">
            {props.loading ? <ActivityIndicator color="black" /> : <SendHorizonal size={19} color="black" />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AIDecisionCard({ response }: { response: AIResponse }) {
  const [showJson, setShowJson] = useState(false);
  const visibleDiff = response.cartDiff.slice(0, 3);
  const visibleImpact = response.impact.slice(0, 3);
  const actionTypes = Array.from(new Set(response.actions.map(action => action.type.replaceAll('_', ' ')))).slice(0, 3);
  return (
    <View className="mt-5 rounded-2xl border border-[#D9A441]/20 bg-[#17120A] p-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-xs font-black uppercase tracking-widest text-[#F1C46D]">AI decision</Text>
          <Text className="mt-1 text-sm font-semibold leading-5 text-neutral-200">{response.normalizedIntent}</Text>
        </View>
        <View className="rounded-full bg-[#D9A441]/15 px-3 py-2">
          <Text className="text-xs font-black text-[#F1C46D]">{Math.round(response.confidence * 100)}%</Text>
        </View>
      </View>
      <View className="mt-4 flex-row flex-wrap gap-2">
        {actionTypes.map(action => (
          <View key={action} className="rounded-xl bg-[#D9A441]/12 px-3 py-2">
            <Text className="text-[10px] font-black uppercase text-[#F1C46D]">{action}</Text>
          </View>
        ))}
        {visibleImpact.map(metric => (
          <View key={`${metric.label}-${metric.value}`} className="rounded-xl bg-white/[0.07] px-3 py-2">
            <Text className="text-[10px] font-black uppercase text-neutral-500">{metric.label}</Text>
            <Text className="mt-1 text-xs font-black text-white">{metric.value}</Text>
          </View>
        ))}
      </View>
      {visibleDiff.length ? (
        <View className="mt-4 gap-2">
          {visibleDiff.map(diff => (
            <Text key={diff} className="text-xs font-semibold leading-5 text-neutral-300">✣ {diff}</Text>
          ))}
        </View>
      ) : null}
      <Pressable onPress={() => setShowJson(!showJson)} className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2">
        <Text className="text-xs font-black text-neutral-200">{showJson ? 'Hide' : 'Show'} Structured JSON</Text>
      </Pressable>
      {showJson ? (
        <View className="mt-3 rounded-xl bg-black/40 p-3">
          <Text className="text-[10px] font-semibold leading-4 text-neutral-300">
            {JSON.stringify({ actions: response.actions, suggestedItems: response.suggestedItems, needsClarification: response.needsClarification }, null, 2)}
          </Text>
        </View>
      ) : null}
      <Text className="mt-4 text-[11px] font-semibold text-neutral-500">{response.provider} · {response.model}</Text>
    </View>
  );
}

function SuggestedTray({ suggested, addItem, lastAssistantMessage }: { suggested: MenuItem[]; addItem: (item: MenuItem) => void; lastAssistantMessage: string }) {
  return (
    <View className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <Text className="text-base font-black text-white">Tap a surfaced option</Text>
      <Text className="mt-2 text-sm leading-5 text-neutral-400">{lastAssistantMessage}</Text>
      <View className="mt-4 gap-3">
        {suggested.map(item => <CompactSuggested key={item.id} item={item} onAdd={() => addItem(item)} />)}
      </View>
    </View>
  );
}

function MenuScreen({ filter, setFilter, activeFilter, clearFilter, visibleMenu, addItem, width }: { filter: MenuFilter; setFilter: (filter: MenuFilter) => void; activeFilter: string | null; clearFilter: () => void; visibleMenu: MenuItem[]; addItem: (item: MenuItem) => void; width: number }) {
  const cardGap = 12;
  const availableWidth = Math.min(width, 420) - 32;
  const cardWidth = Math.max(150, Math.floor((availableWidth - cardGap) / 2));
  return (
    <View className="px-4 pt-12">
      <Text className="text-4xl font-black text-white" style={serif}>Menu</Text>
      <Text className="mt-1 text-sm text-neutral-400">Curated by our AI sommelier</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5">
        <View className="flex-row gap-2 pr-8">
          {menuFilters.map(item => (
            <Pressable key={item} onPress={() => setFilter(item)} className={`rounded-full border px-4 py-2.5 ${filter === item ? 'border-[#D9A441] bg-[#D9A441]' : 'border-white/10 bg-white/[0.07]'}`}>
              <Text className={`font-black ${filter === item ? 'text-black' : 'text-neutral-300'}`}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {activeFilter ? (
        <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-[#D9A441]/25 bg-[#D9A441]/10 px-4 py-3">
          <View>
            <Text className="text-xs font-black uppercase tracking-widest text-[#F1C46D]">AI-filtered</Text>
            <Text className="mt-1 text-sm font-semibold text-neutral-200">{activeFilter} · {visibleMenu.length} match{visibleMenu.length === 1 ? '' : 'es'}</Text>
          </View>
          <Pressable onPress={clearFilter} className="rounded-full bg-white/10 px-3 py-2">
            <Text className="text-xs font-black text-white">Clear</Text>
          </Pressable>
        </View>
      ) : null}
      <View className="mt-4 rounded-2xl border border-white/10 bg-white/[0.08] p-4">
        <Text className="font-black text-[#F1C46D]">✣ AI Pick of the Day</Text>
        <Text className="mt-1 text-xs text-neutral-300">Truffle Wagyu Burger pairs perfectly with our Espresso Martini</Text>
      </View>
      <View className="mt-4 flex-row flex-wrap gap-3">
        {visibleMenu.map(item => <MenuGridCard key={item.id} item={item} onAdd={() => addItem(item)} width={cardWidth} />)}
      </View>
    </View>
  );
}

function CartScreen({ items, total, itemCount, askAI, checkout, updateQuantity, removeItem }: { items: Array<MenuItem & { quantity: number; modifiers?: Record<string, unknown>; notes?: string[] }>; total: number; itemCount: number; askAI: () => void; checkout: () => void; updateQuantity: (id: string, quantity: number) => void; removeItem: (id: string) => void }) {
  return (
    <View className="min-h-screen px-4 pt-14">
      <Text className="text-4xl font-black text-white" style={serif}>Your Order</Text>
      <Text className="mt-1 text-sm text-neutral-400">{itemCount} items</Text>
      {!items.length ? (
        <View className="flex-1 items-center justify-center py-28">
          <ShoppingBag size={44} color="#777" />
          <Text className="mt-5 text-xl font-black text-white">Your cart is empty</Text>
          <Text className="mt-2 text-center text-base text-neutral-400">Start a conversation with our AI concierge</Text>
          <Pressable onPress={askAI} className="mt-6 rounded-full bg-[#D9A441] px-7 py-4">
            <Text className="font-black text-black">✣ Order with AI</Text>
          </Pressable>
        </View>
      ) : (
        <View className="mt-8 gap-3">
          {items.map(item => <OrderLine key={item.id} item={item} updateQuantity={updateQuantity} removeItem={removeItem} />)}
          <View className="mt-3 rounded-2xl border border-white/10 bg-white/[0.08] p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-black text-white">Total</Text>
              <Text className="text-xl font-black text-[#F1C46D]">${total.toFixed(2)}</Text>
            </View>
            <Pressable onPress={checkout} className="mt-4 rounded-full bg-[#D9A441] py-4">
              <Text className="text-center font-black text-black">Place Order</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function OrdersScreen({ orders, cancelOrder, reorderOrder }: { confirmed: boolean; orders: PlacedOrder[]; cancelOrder: (orderId?: string) => boolean; reorderOrder: (orderId: string) => void }) {
  const latest = orders[0];
  const latestCalories = latest?.items.reduce((sum, item) => sum + item.calories * item.quantity, 0) || 0;
  const canCancelLatest = latest?.status === 'confirmed' || latest?.status === 'preparing';
  return (
    <View className="min-h-screen px-4 pt-14">
      <View className="items-center">
        <Orb size={110} />
        <View className="mt-4 items-center">
          <Text className="text-4xl font-black text-white" style={serif}>{latest ? (latest.status === 'cancelled' ? 'Order Cancelled' : 'Order Confirmed') : 'No Active Orders'}</Text>
          <Text className="mt-2 text-center text-base text-neutral-400">{latest ? (latest.status === 'cancelled' ? 'Your receipt is saved and the kitchen ticket is closed' : 'Your AI-curated dining experience is on its way') : 'Place an order and your receipt will appear here'}</Text>
        </View>
      </View>
      <View className="mt-7 rounded-2xl border border-[#D9A441]/25 bg-white/[0.08] p-5" style={{ shadowColor: gold, shadowOpacity: 0.28, shadowRadius: 18 }}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-3">
          <Clock3 size={18} color={gold} />
          <View>
            <Text className="text-sm text-neutral-400">{latest?.status === 'cancelled' ? 'Order Status' : 'Estimated Delivery'}</Text>
            <Text className="text-xl font-black text-[#F1C46D]">{latest ? (latest.status === 'cancelled' ? 'Cancelled' : latest.etaMinutes) : '--'}</Text>
          </View>
          </View>
          {canCancelLatest ? (
            <Pressable onPress={() => cancelOrder(latest.id)} className="rounded-full bg-red-400/15 px-3 py-2">
              <Text className="text-xs font-black text-red-200">Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {latest ? <KitchenTimeline status={latest.status} /> : null}
      {latest ? (
        <View className="mt-4 gap-3">
          {latest.items.map(item => <OrderLine key={`${latest.id}-${item.id}`} item={item} updateQuantity={() => undefined} removeItem={() => undefined} readonly />)}
        </View>
      ) : null}
      {latest ? (
        <Pressable onPress={() => reorderOrder(latest.id)} className="mt-4 rounded-full border border-[#D9A441]/30 bg-[#D9A441]/10 py-3">
          <Text className="text-center font-black text-[#F1C46D]">Reorder to Cart</Text>
        </Pressable>
      ) : null}
      <View className="mt-4 rounded-2xl border border-white/10 bg-white/[0.08] p-5">
        <View className="flex-row items-center gap-2">
          <ReceiptText size={17} color={gold} />
          <Text className="text-lg font-black text-white">Receipt</Text>
        </View>
        <View className="my-5 h-px bg-white/10" />
        <ReceiptTextRow label="Calories" value={`${latestCalories} cal`} />
        <ReceiptRow label="Subtotal" value={latest?.subtotal || 0} />
        <ReceiptRow label="Tax" value={latest?.tax || 0} />
        <View className="my-4 h-px bg-white/10" />
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-black text-white">Total</Text>
          <Text className="text-lg font-black text-[#F1C46D]">${(latest?.total || 0).toFixed(2)}</Text>
        </View>
      </View>
      {orders.length > 1 ? (
        <View className="mt-5">
          <Text className="mb-3 text-lg font-black text-white">Previous Orders</Text>
          {orders.slice(1).map(order => (
            <View key={order.id} className="mb-3 rounded-2xl bg-white/[0.06] p-4">
              <View className="flex-row items-center justify-between">
                <Text className="font-black text-white">{order.items.reduce((sum, item) => sum + item.quantity, 0)} item{order.items.length === 1 ? '' : 's'}</Text>
                <Text className={`text-xs font-black ${order.status === 'cancelled' ? 'text-red-200' : 'text-emerald-300'}`}>{order.status}</Text>
              </View>
              <Text className="mt-1 text-sm text-neutral-400">{new Date(order.placedAt).toLocaleString()}</Text>
              <Text className="mt-2 font-black text-[#F1C46D]">${order.total.toFixed(2)} · {order.items.reduce((sum, item) => sum + item.calories * item.quantity, 0)} cal</Text>
              {order.status === 'confirmed' || order.status === 'preparing' ? (
                <Pressable onPress={() => cancelOrder(order.id)} className="mt-3 self-start rounded-full bg-red-400/15 px-3 py-2">
                  <Text className="text-xs font-black text-red-200">Cancel order</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => reorderOrder(order.id)} className="mt-3 self-start rounded-full bg-white/10 px-3 py-2">
                <Text className="text-xs font-black text-neutral-200">Reorder</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <Text className="mt-9 text-center text-base font-semibold text-neutral-500">Thank you for dining with The Intelligent Bistro</Text>
    </View>
  );
}

function KitchenTimeline({ status }: { status: PlacedOrder['status'] }) {
  const steps = status === 'cancelled' ? ['Received', 'Cancelled'] : ['Received', 'Preparing', 'Ready'];
  const activeIndex = status === 'cancelled' ? 1 : status === 'preparing' ? 1 : 0;
  return (
    <View className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <Text className="mb-3 text-sm font-black uppercase tracking-widest text-neutral-400">Kitchen Timeline</Text>
      <View className="flex-row items-center justify-between">
        {steps.map((step, index) => {
          const active = index <= activeIndex;
          return (
            <View key={step} className="flex-1 items-center">
              <View className={`h-3 w-3 rounded-full ${active ? 'bg-[#D9A441]' : 'bg-white/15'}`} />
              <Text className={`mt-2 text-[11px] font-black ${active ? 'text-[#F1C46D]' : 'text-neutral-500'}`}>{step}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function BottomTabs({ tab, setTab, itemCount }: { tab: Tab; setTab: (tab: Tab) => void; itemCount: number }) {
  const tabs: Array<{ id: Tab; label: string; icon: (color: string) => JSX.Element }> = [
    { id: 'concierge', label: 'Concierge', icon: color => <Sparkles size={22} color={color} /> },
    { id: 'order', label: 'Order', icon: color => <MessageCircle size={22} color={color} /> },
    { id: 'menu', label: 'Menu', icon: color => <UtensilsCrossed size={22} color={color} /> },
    { id: 'cart', label: 'Cart', icon: color => <ShoppingBag size={22} color={color} /> },
    { id: 'orders', label: 'Orders', icon: color => <ReceiptText size={22} color={color} /> }
  ];
  return (
    <View className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#111111]/95 px-3 pb-2 pt-2">
      <View className="flex-row items-center justify-between">
        {tabs.map(item => {
          const active = tab === item.id;
          const color = active ? gold : '#777';
          return (
            <Pressable key={item.id} onPress={() => setTab(item.id)} className="min-w-14 items-center">
              <View className="relative">
                {item.icon(color)}
                {item.id === 'cart' && itemCount ? (
                  <View className="absolute -right-2 -top-1 h-4 min-w-4 items-center justify-center rounded-full bg-[#D9A441] px-1">
                    <Text className="text-[10px] font-black text-black">{itemCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text className={`mt-1 text-[11px] ${active ? 'text-[#D9A441]' : 'text-neutral-500'}`}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View className="mb-3 mt-8 flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Text className="text-lg text-[#D9A441]">{icon}</Text>
        <Text className="text-2xl font-black text-white">{title}</Text>
      </View>
      <Text className="text-sm font-black text-[#D9A441]">See all</Text>
    </View>
  );
}

function LargeDishCard({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  return (
    <Pressable onPress={onAdd} className="w-44 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.08]">
      <ImageBackground source={{ uri: item.image }} className="h-44 justify-end" imageStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.88)']} className="p-3">
          <View className="mb-16 flex-row items-start justify-between">
            <Text className="rounded-full bg-black/45 px-2 py-1 text-xs font-black text-neutral-200">{item.calories} cal</Text>
            <Text className="rounded-full bg-black/45 px-2 py-1 text-sm font-black text-[#F1C46D]">${item.price.toFixed(2)}</Text>
          </View>
          <Text className="text-lg font-black text-white" numberOfLines={1}>{item.name}</Text>
          <Text className="mt-1 text-xs text-neutral-300" numberOfLines={2}>{item.description}</Text>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

function FeaturedCard({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  return (
    <Pressable onPress={onAdd} className="w-[48%] overflow-hidden rounded-2xl">
      <ImageBackground source={{ uri: item.image }} className="h-36 justify-end" imageStyle={{ borderRadius: 16 }}>
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} className="rounded-2xl p-3">
          <Text className="font-black text-white" numberOfLines={1}>{item.name}</Text>
          <Text className="text-sm font-black text-[#F1C46D]">${item.price.toFixed(2)} · {item.calories} cal</Text>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

function MenuGridCard({ item, onAdd, width }: { item: MenuItem; onAdd: () => void; width: number }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07]" style={{ width }}>
      <Image source={{ uri: item.image }} className="h-28 w-full bg-neutral-900" />
      <View className="p-3">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 font-black text-white" numberOfLines={1}>{item.name}</Text>
          <Text className="font-black text-[#F1C46D]">${item.price.toFixed(2)}</Text>
        </View>
        <Text className="mt-1 text-xs font-black text-[#F1C46D]">{item.calories} cal</Text>
        <Text className="mt-1 text-xs leading-4 text-neutral-400" numberOfLines={2}>{item.ingredients.join(', ')}</Text>
        <View className="mt-2 flex-row flex-wrap gap-1">
          {item.tags.slice(0, 2).map(tag => (
            <Text key={tag} className="rounded-md bg-[#D9A441]/15 px-2 py-1 text-[10px] font-black text-[#D9A441]">{tag}</Text>
          ))}
        </View>
        <Pressable onPress={onAdd} className="mt-3 rounded-xl border border-white/10 bg-white/[0.06] py-2.5">
          <Text className="text-center font-black text-white">+ Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CompactSuggested({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  return (
    <Pressable onPress={onAdd} className="flex-row gap-3 rounded-2xl bg-white/[0.06] p-3">
      <Image source={{ uri: item.image }} className="h-20 w-20 rounded-xl bg-neutral-900" />
      <View className="flex-1">
        <Text className="font-black text-white">{item.name}</Text>
        <Text className="mt-1 text-xs leading-4 text-neutral-400" numberOfLines={2}>{item.ingredients.join(', ')}</Text>
        <Text className="mt-2 font-black text-[#F1C46D]">${item.price.toFixed(2)} · {item.calories} cal</Text>
      </View>
    </Pressable>
  );
}

function OrderLine({ item, updateQuantity, removeItem, readonly = false }: { item: MenuItem & { quantity: number; modifiers?: Record<string, unknown>; notes?: string[] }; updateQuantity: (id: string, quantity: number) => void; removeItem: (id: string) => void; readonly?: boolean }) {
  const removed = Array.isArray(item.modifiers?.remove) ? item.modifiers.remove.map(String) : [];
  const ingredients = item.ingredients.filter(ingredient => !removed.some(remove => ingredient.toLowerCase().includes(remove.toLowerCase())));
  return (
    <View className="rounded-2xl bg-white/[0.06] p-3">
      <View className="flex-row gap-3">
        <Image source={{ uri: item.image }} className="h-20 w-20 rounded-xl bg-neutral-900" />
        <View className="flex-1">
          <Text className="font-black text-white">{item.name}</Text>
          <Text className="mt-1 text-xs leading-4 text-neutral-400" numberOfLines={2}>{ingredients.join(', ')}</Text>
          {removed.length ? <Text className="mt-1 text-xs font-semibold text-[#F1C46D]">Removed: {removed.join(', ')}</Text> : null}
          <Text className="mt-1 text-xs font-black text-[#F1C46D]">{item.calories * item.quantity} cal</Text>
          {item.notes?.length ? <Text className="mt-1 text-xs font-semibold text-emerald-300">{item.notes.join(', ')}</Text> : null}
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="font-black text-[#F1C46D]">${(item.price * item.quantity).toFixed(2)}</Text>
            {readonly ? (
              <Text className="font-black text-white">Qty {item.quantity}</Text>
            ) : (
              <View className="flex-row items-center gap-2">
                <Pressable onPress={() => updateQuantity(item.id, item.quantity - 1)} className="h-7 w-7 items-center justify-center rounded-full bg-white/10"><Text className="font-black text-white">-</Text></Pressable>
                <Text className="min-w-5 text-center font-black text-white">{item.quantity}</Text>
                <Pressable onPress={() => updateQuantity(item.id, item.quantity + 1)} className="h-7 w-7 items-center justify-center rounded-full bg-white/10"><Text className="font-black text-white">+</Text></Pressable>
                <Pressable onPress={() => removeItem(item.id)}><Text className="font-black text-red-300">×</Text></Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function ReceiptRow({ label, value }: { label: string; value: number }) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-neutral-400">{label}</Text>
      <Text className="font-black text-neutral-200">${value.toFixed(2)}</Text>
    </View>
  );
}

function ReceiptTextRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-neutral-400">{label}</Text>
      <Text className="font-black text-neutral-200">{value}</Text>
    </View>
  );
}
