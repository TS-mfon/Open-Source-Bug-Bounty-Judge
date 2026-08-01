"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function EnergyField() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    host.current.appendChild(renderer.domElement);
    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `void main(){gl_Position=vec4(position,1.0);}`,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec2 uPointer;
        float field(vec2 p,float t){
          float v=0.0;
          v+=sin(p.x*5.0+sin(p.y*3.2+t)*1.4);
          v+=sin(p.y*7.0+cos(p.x*2.8-t*.7)*1.1);
          v+=sin((p.x+p.y)*4.0+t*.45);
          return abs(v/3.0);
        }
        void main(){
          vec2 uv=gl_FragCoord.xy/uResolution.xy;
          vec2 p=(gl_FragCoord.xy*2.0-uResolution.xy)/min(uResolution.x,uResolution.y);
          p+=vec2((uPointer.x-.5)*.18,(uPointer.y-.5)*.12);
          float f=field(p,uTime*.35);
          float vein=smoothstep(.19,.01,abs(f-.34));
          float fine=smoothstep(.08,.0,abs(field(p*1.8,uTime*.22)-.42))*.35;
          vec3 base=vec3(.015,.02,.035);
          vec3 blue=vec3(.0,.28,.95);
          vec3 cyan=vec3(.0,.9,1.0);
          vec3 color=base+blue*vein*.8+cyan*fine;
          float vignette=smoothstep(1.25,.2,length(uv-.5));
          gl_FragColor=vec4(color*(.55+vignette),.92);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    const resize = () => {
      if (!host.current) return;
      const { clientWidth, clientHeight } = host.current;
      renderer.setSize(clientWidth, clientHeight, false);
      uniforms.uResolution.value.set(clientWidth, clientHeight);
    };
    const move = (event: PointerEvent) => {
      uniforms.uPointer.value.set(
        event.clientX / window.innerWidth,
        1 - event.clientY / window.innerHeight,
      );
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move);
    let frame = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="energy-field" aria-hidden="true" />;
}
