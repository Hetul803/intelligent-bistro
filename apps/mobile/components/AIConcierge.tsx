import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BadgeCheck, Bot, Clock, Code2, Gauge, GitBranch, MessageSquare, ScanSearch, SendHorizonal, Sparkles, Users, Wallet, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import { useCartStore } from '../store/cartStore';
import { sendAIOrder } from '../services/api';
import { menu } from '../constants/menu';
import { AIAction, CartItem } from '../types';

const aiJobs = [
  {
    label: 'Light or healthy',
    prompt: 'I want something light or healthy',
    icon: Sparkles
  },
  {
    label: 'Plan group',
    prompt: 'Build a group order for 4 people under $60 total, one vegetarian, no spicy items',
    icon: Users
  },
  {
    label: 'Spicy under $20',
    prompt: 'I need something spicy but under 20 dollars',
    icon: Zap
  },
  {
    label: 'Optimize budget',
    prompt: 'Optimize this cart to make it cheaper while keeping a complete meal',
    icon: Wallet
  },
  {
    label: 'Fast pickup',
    prompt: 'Build the fastest pickup order',
    icon: Clock
  },
  {
    label: 'Dietary scan',
    prompt: 'Run a dietary scan for safe options',
    icon: ScanSearch
  }
];

function formatAction(action: AIAction) {
  if (action.type === 'ADD_ITEM') return `ADD ${action.quantity || 1}X`;
  if (action.type === 'REMOVE_ITEM') return 'REMOVE';
  if (action.type === 'UPDATE_MODIFIERS') return 'MODIFY';
  if (action.type === 'UPDATE_QUANTITY') return `QTY ${action.quantity || ''}`.trim();
  if (action.type === 'CLEAR_CART') return 'CLEAR';
  if (action.type === 'SHOW_CATEGORY') return 'CATEGORY';
  if (action.type === 'SHOW_FILTERED_ITEMS') return 'FILTER';
  return 'READY';
}

function editPromptsForItem(item: CartItem) {
  const prompts = [
    { label: `Remove ${item.name}`, prompt: `Remove ${item.name}` },
    { label: `Double ${item.name}`, prompt: `Double ${item.name}` }
  ];
  if (item.modifiers?.sizes?.includes('large')) prompts.push({ label: `Make ${item.name} large`, prompt: `Make ${item.name} large` });
  if (item.spiceLevel > 0) prompts.push({ label: `Make ${item.name} mild`, prompt: `Make ${item.name} less spicy` });
  if (item.modifiers?.remove?.some(option => ['sauce', 'aioli', 'slaw'].includes(option))) {
    prompts.push({ label: `No sauce`, prompt: `Make ${item.name} with no sauce` });
  }
  return prompts;
}

export function AIConcierge() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<'plan' | 'json' | 'chat'>('plan');
  const cart = useCartStore(state => state.items);
  const applyAIResponse = useCartStore(state => state.applyAIResponse);
  const lastAssistantMessage = useCartStore(state => state.lastAssistantMessage);
  const lastUserIntent = useCartStore(state => state.lastUserIntent);
  const lastActions = useCartStore(state => state.lastActions);
  const lastSuggestedItems = useCartStore(state => state.lastSuggestedItems);
  const lastAIResponse = useCartStore(state => state.lastAIResponse);
  const conversation = useCartStore(state => state.conversation);
  const lastUpdatedAt = useCartStore(state => state.lastUpdatedAt);
  const suggestedMenuItems = menu.filter(item => lastSuggestedItems.includes(item.id)).slice(0, 4);
  const cartEditPrompts = useMemo(() => cart.flatMap(editPromptsForItem).slice(0, 8), [cart]);
  const visibleActions = lastActions.filter(action => action.type !== 'NO_OP').slice(0, 4);
  const actionJson = useMemo(() => JSON.stringify(lastActions.length ? lastActions : [{ type: 'AWAITING_INTENT' }], null, 2), [lastActions]);
  const confidence = Math.round((lastAIResponse?.confidence ?? 0.86) * 100);
  const providerLabel = lastAIResponse ? `${lastAIResponse.provider}/${lastAIResponse.model}` : 'deterministic-demo-parser';
  const actionTrace = lastAIResponse?.actionTrace || [{ step: 'Ready', detail: 'Tell the AI a goal, constraint, craving, or budget and it will reason against the menu before touching the cart.' }];
  const cartDiff = lastAIResponse?.cartDiff || [];
  const impact = lastAIResponse?.impact || [
    { label: 'Menu scan', value: '8 items' },
    { label: 'Manual taps', value: '0' },
    { label: 'Drinks', value: 'Ask first' }
  ];
  const updatedAt = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'online';

  const submit = async (override?: string) => {
    const text = (override || message).trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      const result = await sendAIOrder(text, cart, conversation);
      applyAIResponse(result, text);
      setMessage('');
    } catch (error) {
      applyAIResponse(
        {
          assistantMessage: 'I could not reach the backend. Make sure the Node server is running on port 4000.',
          actions: [{ type: 'NO_OP' }],
          needsClarification: false,
          clarificationQuestion: null,
          suggestedItems: [],
          provider: 'deterministic',
          model: 'offline-error',
          confidence: 0,
          normalizedIntent: 'Backend unavailable',
          actionTrace: [{ step: 'Network', detail: 'The mobile app could not reach the Node API.' }],
          cartDiff: [],
          impact: [
            { label: 'Status', value: 'Offline' },
            { label: 'Cart ops', value: '0' },
            { label: 'Action', value: 'Retry API' }
          ]
        },
        text
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard className="mb-5">
      <View className="p-5">
        <View className="mb-4 flex-row items-center gap-3">
          <LinearGradient colors={['rgba(20,184,166,0.98)', 'rgba(249,115,22,0.92)']} className="h-12 w-12 items-center justify-center rounded-lg">
            <Bot size={23} color="white" />
          </LinearGradient>
          <View className="flex-1">
            <Text className="text-2xl font-black text-white">AI Order Agent</Text>
            <Text className="mt-1 text-xs font-semibold uppercase tracking-widest text-teal-100">Tell it the outcome, skip the scan</Text>
          </View>
          <View className="items-end">
            <View className="flex-row items-center gap-1 rounded-full bg-emerald-400/15 px-3 py-2">
              <BadgeCheck size={14} color="#6EE7B7" />
              <Text className="text-xs font-black text-emerald-100">{confidence}%</Text>
            </View>
            <Text className="mt-2 text-xs font-semibold text-slate-400">{updatedAt}</Text>
          </View>
        </View>

        <View className="mb-4 rounded-lg bg-slate-950/45 p-3">
          <ScrollView className="max-h-96" nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <View className="gap-3">
              {conversation.map(chat => {
                const isUser = chat.role === 'user';
                return (
                  <View key={chat.id} className={`rounded-lg px-4 py-3 ${isUser ? 'self-end bg-teal-300/20' : 'self-start bg-white/10'}`} style={{ maxWidth: '88%' }}>
                    <Text className="text-xs font-black uppercase tracking-widest text-slate-400">{isUser ? 'You' : 'Bistro AI'}</Text>
                    <Text className="mt-1 text-sm font-semibold leading-5 text-white">{chat.content}</Text>
                  </View>
                );
              })}
              {loading ? (
                <View className="self-start rounded-lg bg-white/10 px-4 py-3">
                  <ActivityIndicator color="#5EEAD4" />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>

        {suggestedMenuItems.length ? (
          <View className="mb-4 gap-3 rounded-lg bg-amber-300/10 p-3">
            <View className="flex-row items-center gap-2">
              <Sparkles size={14} color="#FCD34D" />
              <Text className="text-xs font-black uppercase tracking-widest text-amber-100">AI narrowed the menu</Text>
            </View>
            <View className="gap-2">
              {suggestedMenuItems.map(item => (
                <Pressable key={item.id} onPress={() => submit(`Add ${item.name}`)} className="flex-row items-center gap-3 rounded-lg bg-black/25 p-2">
                  <Image source={{ uri: item.image }} className="h-16 w-16 rounded-lg bg-slate-900" />
                  <View className="flex-1">
                    <Text className="font-black text-white">{item.name}</Text>
                    <Text className="mt-1 text-xs font-semibold text-slate-300">${item.price.toFixed(2)} · {item.tags.slice(0, 2).join(' · ')}</Text>
                    <Text className="mt-1 text-xs font-semibold text-teal-100">{item.spiceLevel ? `heat ${item.spiceLevel}` : 'mild'} · {item.category}</Text>
                  </View>
                  <View className="rounded-full bg-teal-300 px-3 py-2">
                    <Text className="text-xs font-black text-slate-950">Choose</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {cartEditPrompts.length ? (
          <View className="mb-4 gap-3 rounded-lg bg-teal-300/10 p-3">
            <View className="flex-row items-center gap-2">
              <MessageSquare size={14} color="#5EEAD4" />
              <Text className="text-xs font-black uppercase tracking-widest text-teal-100">Edit from chat</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2 pr-3">
                {cartEditPrompts.map(edit => (
                  <Pressable key={`${edit.label}-${edit.prompt}`} onPress={() => submit(edit.prompt)} className="rounded-full bg-white/10 px-3 py-2">
                    <Text className="text-xs font-black text-slate-100">{edit.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        <LinearGradient colors={['rgba(20,184,166,0.22)', 'rgba(249,115,22,0.14)', 'rgba(15,23,42,0.65)']} className="mb-4 rounded-lg p-3">
          <View className="mb-3 flex-row items-center gap-2">
            <Zap size={17} color="#FDBA74" />
            <Text className="text-xs font-black uppercase tracking-widest text-orange-100">Ask naturally</Text>
          </View>
          <View className="flex-row items-center gap-3 rounded-lg bg-black/40 px-4 py-3">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="I want something light and healthy..."
              placeholderTextColor="#94A3B8"
              className="min-h-10 flex-1 text-base font-semibold text-white"
              returnKeyType="send"
              onSubmitEditing={() => submit()}
            />
            <Pressable onPress={() => submit()} className="overflow-hidden rounded-lg">
              <LinearGradient colors={['#14B8A6', '#F97316']} className="h-12 w-12 items-center justify-center">
                {loading ? <ActivityIndicator color="white" /> : <SendHorizonal size={19} color="white" />}
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2 pr-4">
            {aiJobs.map(job => {
              const Icon = job.icon;
              return (
                <Pressable key={job.label} onPress={() => submit(job.prompt)} className="flex-row items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Icon size={14} color="#5EEAD4" />
                  <Text className="text-xs font-black text-slate-100">{job.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View className="mb-4 flex-row gap-2">
          {impact.map(item => (
            <View key={`${item.label}-${item.value}`} className="flex-1 rounded-lg bg-slate-950/45 p-3">
              <Text className="text-xs font-black uppercase tracking-widest text-slate-400">{item.label}</Text>
              <Text className="mt-1 text-base font-black text-white">{item.value}</Text>
            </View>
          ))}
        </View>

        <View className="mb-4 gap-3 rounded-lg bg-black/25 p-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <Gauge size={14} color="#FCD34D" />
            <Text className="text-xs font-black text-amber-100">{providerLabel}</Text>
            {lastAIResponse?.normalizedIntent ? (
              <View className="rounded-full bg-white/10 px-3 py-2">
                <Text className="text-xs font-black text-slate-100">{lastAIResponse.normalizedIntent}</Text>
              </View>
            ) : null}
          </View>
          <Text className="text-xs font-black uppercase tracking-widest text-teal-100">Latest decision</Text>
          <Text className="text-sm font-black leading-5 text-white">{lastUserIntent}</Text>
          <Text className="text-sm leading-5 text-slate-200">{lastAssistantMessage}</Text>
          {visibleActions.length ? (
            <View className="flex-row flex-wrap gap-2">
              {visibleActions.map((action, index) => (
                <View key={`${action.type}-${action.itemId || index}`} className="rounded-full bg-teal-300/15 px-3 py-2">
                  <Text className="text-xs font-black text-teal-100">{formatAction(action)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View className="mb-3 flex-row rounded-lg bg-slate-950/65 p-1">
          {[
            { id: 'plan', label: 'Plan', icon: GitBranch },
            { id: 'json', label: 'JSON', icon: Code2 },
            { id: 'chat', label: 'History', icon: MessageSquare }
          ].map(panel => {
            const selected = activePanel === panel.id;
            const Icon = panel.icon;
            return (
              <Pressable key={panel.id} onPress={() => setActivePanel(panel.id as 'plan' | 'json' | 'chat')} className={`flex-1 flex-row items-center justify-center gap-2 rounded-md py-3 ${selected ? 'bg-white/10' : ''}`}>
                <Icon size={14} color={selected ? '#5EEAD4' : '#94A3B8'} />
                <Text className={`text-xs font-black ${selected ? 'text-white' : 'text-slate-400'}`}>{panel.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View className="rounded-lg bg-slate-950/55 p-3">
          {activePanel === 'plan' ? (
            <View className="gap-3">
              {actionTrace.map(trace => (
                <View key={`${trace.step}-${trace.detail}`} className="flex-row gap-3">
                  <View className="mt-2 h-2 w-2 rounded-full bg-amber-300" />
                  <View className="flex-1">
                    <Text className="text-sm font-black text-white">{trace.step}</Text>
                    <Text className="mt-1 text-xs leading-5 text-slate-300">{trace.detail}</Text>
                  </View>
                </View>
              ))}
              {cartDiff.length ? (
                <View className="gap-1 border-t border-white/10 pt-3">
                  {cartDiff.map(diff => (
                    <Text key={diff} className="text-xs font-semibold text-emerald-100">+ {diff}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {activePanel === 'json' ? (
            <Text className="font-mono text-xs leading-5 text-violet-100">{actionJson}</Text>
          ) : null}

          {activePanel === 'chat' ? (
            <View className="gap-2">
              {conversation.map(chat => (
                <View key={chat.id} className={`rounded-lg px-3 py-2 ${chat.role === 'user' ? 'bg-teal-300/15' : 'bg-white/10'}`}>
                  <Text className="text-xs font-black uppercase tracking-widest text-slate-400">{chat.role === 'user' ? 'You' : 'Assistant'}</Text>
                  <Text className="mt-1 text-sm font-semibold leading-5 text-white">{chat.content}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </GlassCard>
  );
}
