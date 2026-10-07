import React, { useEffect } from "react";

export interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: string;
  keywords?: string;
}

const DEFAULT_TITLE = "KapsApp - Sesli Sohbet, Canlı Harita, Ders Klasörleri ve Sosyal Oyunlar";
const DEFAULT_DESC = "KapsApp; gerçek zamanlı sesli sohbet kanalları, gizlilik korumalı canlı harita takibi, interaktif ders klasörleri/paylaşımı ile Batak, Blackjack 21, Okey, UNO ve Gartic sosyal oyunlarını tek bir çatı altında birleştiren yeni nesil sosyal iletişim ve eğitim platformudur.";
const DEFAULT_CANONICAL = "https://kapsapp.online/";

export function useSEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESC,
  canonical = DEFAULT_CANONICAL,
  ogType = "website",
  keywords
}: SEOProps) {
  useEffect(() => {
    // 1. Update Document Title
    document.title = title;

    // 2. Update Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", description);

    // 3. Update Canonical Link
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", canonical);

    // 4. Update OpenGraph Tags
    const setMetaProperty = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setMetaProperty("og:title", title);
    setMetaProperty("og:description", description);
    setMetaProperty("og:url", canonical);
    setMetaProperty("og:type", ogType);

    // 5. Update Twitter Card Tags
    const setMetaName = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setMetaName("twitter:title", title);
    setMetaName("twitter:description", description);

    if (keywords) {
      setMetaName("keywords", keywords);
    }
  }, [title, description, canonical, ogType, keywords]);
}

export default function SEO(props: SEOProps) {
  useSEO(props);
  return null;
}
