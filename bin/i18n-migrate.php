<?php
/** One-shot token-aware PHP gettext migration; no evaluation of source strings. */
$files = array_merge(glob('includes/*.php'), ['ramsey-labels-independent.php','uninstall.php']);
foreach ($files as $file) {
    $tokens=token_get_all(file_get_contents($file));$output='';$significant=[];$changes=0;
    foreach($tokens as $index=>$token) {
        $text=is_array($token)?$token[1]:$token;
        if(is_array($token) && $token[0]===T_CONSTANT_ENCAPSED_STRING) {
            $quote=$text[0];$value=substr($text,1,-1);
            $value=$quote==="'"?str_replace(["\\'","\\\\"],["'","\\"],$value):stripcslashes($value);
            $next=$index+1;while(isset($tokens[$next]) && is_array($tokens[$next]) && $tokens[$next][0]===T_WHITESPACE)++$next;
            $is_key=isset($tokens[$next]) && is_array($tokens[$next]) && $tokens[$next][0]===T_DOUBLE_ARROW;
            $inside_gettext=count($significant)>=2 && end($significant)==='(' && in_array($significant[count($significant)-2],['__','esc_html__','esc_attr__'],true);
            $natural=preg_match('/[A-Za-z]{2,}\s+[A-Za-z]{2,}/',$value) && !preg_match('~[<>{}\\\\]|://|^/?[\\^]|^(?:SELECT|SHOW|INSERT|UPDATE|DELETE)\b~i',$value) && !in_array($value,['Times New Roman','Courier New'],true);
            $exception_literal=count($significant)>=2 && end($significant)==='(' && preg_match('/Exception$/',$significant[count($significant)-2]);
            if(($natural || $exception_literal) && !$is_key && !$inside_gettext){$text="__( $text, 'ramsey-labels-independent' )";++$changes;}
        }
        $output.=$text;
        if(!is_array($token) || !in_array($token[0],[T_WHITESPACE,T_COMMENT,T_DOC_COMMENT],true))$significant[]=is_array($token)?$token[1]:$token;
    }
    $output=preg_replace('/(throw new \\\\[A-Za-z]+Exception\( )__\(/','$1esc_html__(',$output);
    file_put_contents($file,$output);echo "$file: $changes gettext expressions\n";
}
