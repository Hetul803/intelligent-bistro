import { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export function GlassCard({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <BlurView intensity={42} tint="dark" className={`overflow-hidden rounded-lg ${className}`}>
      <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']} className="border border-white/10">
        <View>{children}</View>
      </LinearGradient>
    </BlurView>
  );
}
