import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Bot, SendHorizonal, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import { useCartStore } from '../store/cartStore';
import { sendAIOrder } from '../services/api';

const quickPrompts = [
  'Add two spicy chicken sandwiches and a large water',
  'Show me vegetarian options',
  'Remove the fries',
  'Clear my cart'
];

export function AIConcierge() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const cart = useCartStore(state => state.items);
  const applyActions = useCartStore(state => state.applyActions);
  const lastAssistantMessage = useCartStore(state => state.lastAssistantMessage);

  const submit = async (override?: string) => {
    const text = (override || message).trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      const result = await sendAIOrder(text, cart);
      applyActions(result.actions, result.clarificationQuestion || result.assistantMessage);
      setMessage('');
    } catch (error) {
      applyActions([], 'I could not reach the backend. Make sure the Node server is running on port 4000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard className="mb-5">
      <View className="p-5">
        <View className="mb-4 flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/25">
            <Bot size={22} color="#C4B5FD" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-black text-white">AI Concierge</Text>
            <Text className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Structured ordering engine</Text>
          </View>
          <Sparkles size={20} color="#22D3EE" />
        </View>

        <View className="mb-4 rounded-3xl bg-cyan-400/10 p-4">
          <Text className="leading-6 text-cyan-50">{lastAssistantMessage}</Text>
        </View>

        <View className="mb-4 flex-row flex-wrap gap-2">
          {quickPrompts.map(prompt => (
            <Pressable key={prompt} onPress={() => submit(prompt)} className="rounded-full bg-white/10 px-3 py-2">
              <Text className="text-xs font-semibold text-slate-100">{prompt}</Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row items-center gap-3 rounded-3xl bg-black/30 px-4 py-3">
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Ask: add two spicy chicken sandwiches..."
            placeholderTextColor="#64748B"
            className="flex-1 text-base text-white"
            returnKeyType="send"
            onSubmitEditing={() => submit()}
          />
          <Pressable onPress={() => submit()} className="overflow-hidden rounded-full">
            <LinearGradient colors={['#8B5CF6', '#06B6D4']} className="h-12 w-12 items-center justify-center">
              {loading ? <ActivityIndicator color="white" /> : <SendHorizonal size={19} color="white" />}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </GlassCard>
  );
}
