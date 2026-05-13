import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { BadgeCheck, Bot, Command, SendHorizonal, Sparkles, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import { useCartStore } from '../store/cartStore';
import { sendAIOrder } from '../services/api';
import { menu } from '../constants/menu';
import { AIAction } from '../types';

const quickPrompts = [
  { label: 'Crew lunch', prompt: 'Build the viral combo for two' },
  { label: 'Clean fuel', prompt: 'Build me a high-protein lunch under $25' },
  { label: 'Plant mode', prompt: 'I want vegetarian and refreshing' },
  { label: 'Tame heat', prompt: 'Make everything less spicy' }
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
  const applyActions = useCartStore(state => state.applyActions);
  const lastAssistantMessage = useCartStore(state => state.lastAssistantMessage);
  const lastUserIntent = useCartStore(state => state.lastUserIntent);
  const lastActions = useCartStore(state => state.lastActions);
  const lastSuggestedItems = useCartStore(state => state.lastSuggestedItems);
  const lastUpdatedAt = useCartStore(state => state.lastUpdatedAt);
  const suggestedMenuItems = menu.filter(item => lastSuggestedItems.includes(item.id)).slice(0, 3);
  const visibleActions = lastActions.filter(action => action.type !== 'NO_OP').slice(0, 4);
  const updatedAt = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'online';

  const submit = async (override?: string) => {
    const text = (override || message).trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      const result = await sendAIOrder(text, cart);
      applyActions(result.actions, result.clarificationQuestion || result.assistantMessage, text, result.suggestedItems);
      setMessage('');
    } catch (error) {
      applyActions([], 'I could not reach the backend. Make sure the Node server is running on port 4000.', text);
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
            <Text className="text-xl font-black text-white">Neural Concierge</Text>
            <Text className="mt-1 text-xs font-semibold uppercase tracking-widest text-teal-100">Intent engine active</Text>
          </View>
          <View className="items-end">
            <View className="flex-row items-center gap-1 rounded-full bg-emerald-400/15 px-3 py-2">
              <BadgeCheck size={14} color="#6EE7B7" />
              <Text className="text-xs font-black text-emerald-100">VALIDATED</Text>
            </View>
            <Text className="mt-2 text-xs font-semibold text-slate-400">{updatedAt}</Text>
          </View>
        </View>

        <View className="mb-4 gap-3 rounded-lg bg-black/25 p-4">
          <View className="flex-row items-center gap-2">
            <Command size={15} color="#5EEAD4" />
            <Text className="text-xs font-black uppercase tracking-widest text-teal-100">Last intent</Text>
          </View>
          <Text className="text-base font-semibold leading-6 text-white">{lastUserIntent}</Text>
          <View className="h-px bg-white/10" />
          <Text className="leading-6 text-slate-200">{lastAssistantMessage}</Text>
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
