import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BadgeCheck, Bot, Code2, Command, Gauge, GitBranch, MessageSquare, SendHorizonal, Sparkles, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import { useCartStore } from '../store/cartStore';
import { sendAIOrder } from '../services/api';
import { menu } from '../constants/menu';
import { AIAction } from '../types';

const quickPrompts = [
  { label: 'Parse demo', prompt: 'Add two spicy chicken sandwiches and a large water' },
  { label: 'Crew lunch', prompt: 'Build the viral combo for two' },
  { label: 'Surprise me', prompt: 'Surprise me with the best order' },
  { label: 'Plant mode', prompt: 'I want vegetarian and refreshing' },
  { label: 'Gluten-free', prompt: 'Show me gluten-free options' }
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

export function AIConcierge() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const cart = useCartStore(state => state.items);
  const addItem = useCartStore(state => state.addItem);
  const applyAIResponse = useCartStore(state => state.applyAIResponse);
  const lastAssistantMessage = useCartStore(state => state.lastAssistantMessage);
  const lastUserIntent = useCartStore(state => state.lastUserIntent);
  const lastActions = useCartStore(state => state.lastActions);
  const lastSuggestedItems = useCartStore(state => state.lastSuggestedItems);
  const lastAIResponse = useCartStore(state => state.lastAIResponse);
  const conversation = useCartStore(state => state.conversation);
  const lastUpdatedAt = useCartStore(state => state.lastUpdatedAt);
  const suggestedMenuItems = menu.filter(item => lastSuggestedItems.includes(item.id)).slice(0, 3);
  const visibleActions = lastActions.filter(action => action.type !== 'NO_OP').slice(0, 4);
  const actionJson = useMemo(() => JSON.stringify(lastActions.length ? lastActions : [{ type: 'AWAITING_INTENT' }], null, 2), [lastActions]);
  const confidence = Math.round((lastAIResponse?.confidence ?? 0.86) * 100);
  const providerLabel = lastAIResponse ? `${lastAIResponse.provider}/${lastAIResponse.model}` : 'deterministic-demo-parser';
  const updatedAt = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'online';

  const submit = async (override?: string) => {
    const text = (override || message).trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      const result = await sendAIOrder(text, cart);
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
          cartDiff: []
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
          <LinearGradient colors={['rgba(20,184,166,0.95)', 'rgba(249,115,22,0.9)']} className="h-12 w-12 items-center justify-center rounded-lg">
            <Bot size={23} color="white" />
          </LinearGradient>
          <View className="flex-1">
            <Text className="text-xl font-black text-white">AI Order Brain</Text>
            <Text className="mt-1 text-xs font-semibold uppercase tracking-widest text-teal-100">Natural language to cart JSON</Text>
          </View>
          <View className="items-end">
            <View className="flex-row items-center gap-1 rounded-full bg-emerald-400/15 px-3 py-2">
              <BadgeCheck size={14} color="#6EE7B7" />
              <Text className="text-xs font-black text-emerald-100">{confidence}%</Text>
            </View>
            <Text className="mt-2 text-xs font-semibold text-slate-400">{updatedAt}</Text>
          </View>
        </View>

        <View className="mb-4 gap-3 rounded-lg bg-black/25 p-4">
          <View className="flex-row items-center gap-2">
            <Command size={15} color="#5EEAD4" />
            <Text className="text-xs font-black uppercase tracking-widest text-teal-100">Current AI transaction</Text>
          </View>
          <Text className="text-base font-semibold leading-6 text-white">{lastUserIntent}</Text>
          <View className="h-px bg-white/10" />
          <Text className="leading-6 text-slate-200">{lastAssistantMessage}</Text>
          <View className="flex-row flex-wrap gap-2 pt-1">
            <View className="flex-row items-center gap-1 rounded-full bg-white/10 px-3 py-2">
              <Gauge size={13} color="#FCD34D" />
              <Text className="text-xs font-black text-amber-100">{providerLabel}</Text>
            </View>
            {lastAIResponse?.normalizedIntent ? (
              <View className="rounded-full bg-white/10 px-3 py-2">
                <Text className="text-xs font-black text-slate-100">{lastAIResponse.normalizedIntent}</Text>
              </View>
            ) : null}
          </View>
          {visibleActions.length ? (
            <View className="flex-row flex-wrap gap-2 pt-1">
              {visibleActions.map((action, index) => (
                <View key={`${action.type}-${action.itemId || index}`} className="rounded-full bg-teal-300/15 px-3 py-2">
                  <Text className="text-xs font-black text-teal-100">{formatAction(action)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View className="mb-4 gap-3">
          <View className="rounded-lg bg-slate-950/55 p-3">
            <View className="mb-2 flex-row items-center gap-2">
              <MessageSquare size={14} color="#5EEAD4" />
              <Text className="text-xs font-black uppercase tracking-widest text-teal-100">Conversation</Text>
            </View>
            <ScrollView className="max-h-44" nestedScrollEnabled>
              <View className="gap-2">
                {conversation.map(chat => (
                  <View key={chat.id} className={`rounded-lg px-3 py-2 ${chat.role === 'user' ? 'bg-teal-300/15' : 'bg-white/10'}`}>
                    <Text className="text-xs font-black uppercase tracking-widest text-slate-400">{chat.role === 'user' ? 'You' : 'Assistant'}</Text>
                    <Text className="mt-1 text-sm font-semibold leading-5 text-white">{chat.content}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          <View className="rounded-lg bg-slate-950/55 p-3">
            <View className="mb-2 flex-row items-center gap-2">
              <GitBranch size={14} color="#FCD34D" />
              <Text className="text-xs font-black uppercase tracking-widest text-amber-100">Action trace</Text>
            </View>
            <View className="gap-2">
              {(lastAIResponse?.actionTrace || [{ step: 'Awaiting intent', detail: 'Ask the assistant to build or modify an order.' }]).map(trace => (
                <View key={`${trace.step}-${trace.detail}`} className="flex-row gap-3">
                  <View className="mt-2 h-2 w-2 rounded-full bg-amber-300" />
                  <View className="flex-1">
                    <Text className="text-sm font-black text-white">{trace.step}</Text>
                    <Text className="mt-1 text-xs leading-5 text-slate-300">{trace.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="rounded-lg bg-slate-950/55 p-3">
            <View className="mb-2 flex-row items-center gap-2">
              <Code2 size={14} color="#C4B5FD" />
              <Text className="text-xs font-black uppercase tracking-widest text-violet-100">Structured JSON actions</Text>
            </View>
            <Text className="font-mono text-xs leading-5 text-violet-100">{actionJson}</Text>
            {lastAIResponse?.cartDiff?.length ? (
              <View className="mt-3 gap-1 border-t border-white/10 pt-3">
                {lastAIResponse.cartDiff.map(diff => (
                  <Text key={diff} className="text-xs font-semibold text-emerald-100">+ {diff}</Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View className="mb-4 flex-row flex-wrap gap-2">
          {quickPrompts.map(prompt => (
            <Pressable key={prompt.label} onPress={() => submit(prompt.prompt)} className="rounded-full bg-white/10 px-3 py-2">
              <Text className="text-xs font-black text-slate-100">{prompt.label}</Text>
            </Pressable>
          ))}
        </View>

        {suggestedMenuItems.length ? (
          <View className="mb-4 gap-2 rounded-lg bg-amber-300/10 p-3">
            <View className="flex-row items-center gap-2">
              <Sparkles size={14} color="#FCD34D" />
              <Text className="text-xs font-black uppercase tracking-widest text-amber-100">Suggested next</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {suggestedMenuItems.map(item => (
                <Pressable key={item.id} onPress={() => addItem(item)} className="rounded-full bg-amber-200/15 px-3 py-2">
                  <Text className="text-xs font-bold text-amber-50">{item.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View className="flex-row items-center gap-3 rounded-lg bg-black/35 px-4 py-3">
          <Zap size={18} color="#F97316" />
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Ask for a combo, filter, modification, or cart reset"
            placeholderTextColor="#94A3B8"
            className="flex-1 text-base text-white"
            returnKeyType="send"
            onSubmitEditing={() => submit()}
          />
          <Pressable onPress={() => submit()} className="overflow-hidden rounded-lg">
            <LinearGradient colors={['#14B8A6', '#F97316']} className="h-12 w-12 items-center justify-center">
              {loading ? <ActivityIndicator color="white" /> : <SendHorizonal size={19} color="white" />}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </GlassCard>
  );
}
