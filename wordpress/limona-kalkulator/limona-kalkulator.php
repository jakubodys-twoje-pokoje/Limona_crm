<?php
/**
 * Plugin Name: Limona Kalkulator Nieruchomości
 * Description: Kalkulator opłacalności nieruchomości — poniżej i powyżej wartości zadłużenia.
 * Version: 1.0.0
 * Author: Limona
 * Text Domain: limona-kalkulator
 */

if (!defined('ABSPATH')) exit;

function limona_kalkulator_enqueue($hook) {
    // Only load on pages/posts that contain the shortcode (handled by shortcode detection)
}

function limona_kalkulator_shortcode($atts) {
    $atts = shortcode_atts(array(
        'theme' => 'dark', // 'dark' or 'light'
    ), $atts, 'limona_kalkulator');

    $theme_class = $atts['theme'] === 'light' ? ' lk-light' : '';

    // Enqueue React from CDN
    wp_enqueue_script(
        'react-prod',
        'https://unpkg.com/react@18/umd/react.production.min.js',
        array(),
        '18',
        true
    );
    wp_enqueue_script(
        'react-dom-prod',
        'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
        array('react-prod'),
        '18',
        true
    );
    wp_enqueue_script(
        'limona-kalkulator-js',
        plugin_dir_url(__FILE__) . 'kalkulator.js',
        array('react-prod', 'react-dom-prod'),
        '1.0.0',
        true
    );
    wp_enqueue_style(
        'limona-kalkulator-css',
        plugin_dir_url(__FILE__) . 'kalkulator.css',
        array(),
        '1.0.0'
    );

    $id = 'limona-kalkulator-' . wp_unique_id();

    return '<div id="' . esc_attr($id) . '" class="limona-kalkulator-root' . esc_attr($theme_class) . '"></div>'
         . '<script>document.addEventListener("DOMContentLoaded",function(){'
         . 'if(window.LimonaKalkulator&&window.ReactDOM){'
         . 'ReactDOM.createRoot(document.getElementById("' . esc_js($id) . '")).render(React.createElement(window.LimonaKalkulator));'
         . '}});</script>';
}
add_shortcode('limona_kalkulator', 'limona_kalkulator_shortcode');
