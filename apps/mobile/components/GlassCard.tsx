import { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export function GlassCard({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <BlurView intensity={38} tint="dark" className={`overflow-hidden rounded-3xl ${className}`}>
      <LinearGradient colors={['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.035)']} className="border border-white/10">
        <View>{children}</View>
      </LinearGradient>
    </BlurView>
  );
}
