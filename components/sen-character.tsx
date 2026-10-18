'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float, Environment, Lightformer, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface Wardrobe {
  color: string;
  roughness: number;
  metalness: number;
}

function CharacterMesh({ 
  mood = 'calm', 
  isSpeaking = false, 
  isListening = false,
  speedMultiplier = 1,
  distortMultiplier = 1,
  wardrobe = { color: '#ff0844', roughness: 0.1, metalness: 0.8 }
}: { 
  mood?: string, 
  isSpeaking?: boolean, 
  isListening?: boolean,
  speedMultiplier?: number,
  distortMultiplier?: number,
  wardrobe?: Wardrobe
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);

  useFrame((state) => {
    if (meshRef.current && materialRef.current) {
      // Base rotation
      meshRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.5 * speedMultiplier) * 0.2;
      meshRef.current.rotation.y = Math.cos(state.clock.getElapsedTime() * 0.3 * speedMultiplier) * 0.2;

      // Animation based on state
      let targetDistort = 0.4;
      let targetSpeed = 2;

      if (isSpeaking) {
        const scale = 1 + Math.sin(state.clock.getElapsedTime() * 8 * speedMultiplier) * 0.08;
        meshRef.current.scale.set(scale, scale, scale);
        targetDistort = 0.6 + Math.sin(state.clock.getElapsedTime() * 4 * speedMultiplier) * 0.2;
        targetSpeed = 4;
      } else if (isListening) {
        const scale = 1 + Math.sin(state.clock.getElapsedTime() * 2 * speedMultiplier) * 0.03;
        meshRef.current.scale.set(scale, scale, scale);
        targetDistort = 0.3;
        targetSpeed = 1;
      } else {
        // Idle state
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        targetDistort = mood === 'energetic' ? 0.5 : 0.4;
        targetSpeed = mood === 'energetic' ? 3 : 2;
      }

      // Apply multipliers and smoothly interpolate
      materialRef.current.distort = THREE.MathUtils.lerp(materialRef.current.distort, targetDistort * distortMultiplier, 0.1);
      materialRef.current.speed = THREE.MathUtils.lerp(materialRef.current.speed, targetSpeed * speedMultiplier, 0.1);
    }
  });

  return (
    <Float speed={(isSpeaking ? 4 : 2) * speedMultiplier} rotationIntensity={(isListening ? 0.2 : 0.5) * distortMultiplier} floatIntensity={(isListening ? 0.5 : 1) * distortMultiplier}>
      <Sphere ref={meshRef} args={[1.2, 64, 64]}>
        <MeshDistortMaterial
          ref={materialRef}
          color={wardrobe.color}
          emissive={wardrobe.color}
          emissiveIntensity={0.2}
          attach="material"
          distort={0.4 * distortMultiplier}
          speed={2 * speedMultiplier}
          roughness={wardrobe.roughness}
          metalness={wardrobe.metalness}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </Sphere>
      {/* Inner glowing core */}
      <Sphere args={[0.9, 32, 32]}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </Sphere>
    </Float>
  );
}

export default function SenCharacter({ 
  mood, 
  isSpeaking, 
  isListening,
  speedMultiplier,
  distortMultiplier,
  wardrobe
}: { 
  mood?: string, 
  isSpeaking?: boolean, 
  isListening?: boolean,
  speedMultiplier?: number,
  distortMultiplier?: number,
  wardrobe?: Wardrobe
}) {
  return (
    <div className="w-full h-full min-h-[240px]">
      <Canvas camera={{ position: [0, 0, 4.5], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#ffd1ff" />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} color="#ff9a9e" />
        {/* Reflections built from local light panels: presets fetch an HDR from a CDN and crash the scene offline. */}
        <Environment resolution={256}>
          <Lightformer intensity={2} color="#ffb38a" position={[0, 5, -9]} scale={[10, 10, 1]} />
          <Lightformer intensity={1.5} color="#ff6f91" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
          <Lightformer intensity={1} color="#c3a6ff" position={[5, -1, -1]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} />
        </Environment>
        <CharacterMesh 
          mood={mood} 
          isSpeaking={isSpeaking} 
          isListening={isListening} 
          speedMultiplier={speedMultiplier}
          distortMultiplier={distortMultiplier}
          wardrobe={wardrobe}
        />
        <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={10} blur={2} far={4} color={wardrobe?.color || '#000000'} />
      </Canvas>
    </div>
  );
}
